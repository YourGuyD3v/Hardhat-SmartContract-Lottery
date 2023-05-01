const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name) ? describe.skip
: describe("Raflle Unit testing", function () {
    let raffle, vrfCoordinatorV2Mock, deployer, raffleEntranceFee, interval

    beforeEach(async () => {
         deployer  = (await getNamedAccounts()).deployer
         await deployments.fixture(["all"])
         raffle = await ethers.getContract("Raffle", deployer)
         vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
         raffleEntranceFee = await raffle.getEntranceFee()
         interval = await raffle.getInterval()
    })

    describe("constructor", function () {
        it("initializes the raffle correctly", async () => {
            const raffleState = await raffle.getRaffleState()
            assert.equal(raffleState.toString(), "0")
            assert.equal(interval.toString(), networkConfig[(network.config.chainId)]["interval"])
        })
    })

    describe("enterRaffle", function () {
        it("Reverts when you don't pay enough", async () => {
            await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__sentMoreToEnterRaffle")
        })

        it("Record player when enter", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            const contractPlayer = await raffle.getPlayer(0)
            assert.equal(contractPlayer, deployer)
        })

        it("emits event on enter", async () => {
            await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.emit(raffle, "RaffleEnter")
        })

        it("doesn't allow enterance when raffle is calculating", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            // we pretent to be chainlink keeper
            await raffle.performUpkeep([])
            await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle__raffleNotOpen")
        })
    })

    describe("checkUpkeep", function (){
        it("returns false if people haven't sent any Eth", async () => {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
            assert(!upkeepNeeded)
        })

        it("returns false if raffle isn't open", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            await raffle.performUpkeep([])
            const raffleState = await raffle.getRaffleState()
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
            assert.equal(raffleState.toString() == "1", upkeepNeeded == false  )
        })

        it("returns false if enough time isn't passed", async () =>{
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() - 5])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
            assert(!upkeepNeeded)
        })

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
            assert(upkeepNeeded)
        })
    })

    describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const tx = await raffle.performUpkeep([])
            assert(tx)
        })

        it("reverts if checkupkeep is false", async () => {
            await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__upKeepNotNeed")
        })

        it("updates the raffle state and emits a requestId", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const txResponse = await raffle.performUpkeep([])
            const txReceipt = await txResponse.wait(1)
            const raffleState = await raffle.getRaffleState()
            const requestId = txReceipt.events[1].args.requestId
            assert(requestId.toNumber() > 0)
            assert(raffleState == 1)
        })
    })

    describe("fulfillRandomWords", function () {
        beforeEach(async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
        })

        it("can only be called after performupkeep", async () => {
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
        })

        it("picks a winner, resets, and sends money", async () => {
            const additionalEntrance = 3
            const startingIndex = 1 // deployer = 0
            const accounts = await ethers.getSigners()
            for(let i = startingIndex; i < startingIndex + additionalEntrance; i++) {
              const accountConnectRaffle = await raffle.connect(accounts[i])
              await raffle.enterRaffle({ value: raffleEntranceFee })
            }
            const startingTimeStamp = await raffle.getLastTimeStamp()
          
            await new Promise(async(resolve, reject) => {
              raffle.once("WinnerPicked", async () => {
                console.log("WinnerPicked event fired!")
                try {
                  console.log(recentWinner)
                  console.log(accounts[0].address)
                  console.log(accounts[2].address)
                  console.log(accounts[3].address)
                  console.log(accounts[1].address)
                  const recentWinner = await raffle.getRecentWinner()
                  const numOfPlayer = await raffle.getNumOfPlayers()
                  const raffleState = await raffle.getRaffleState()
                  const endingTimeStamp = await raffle.getLastTimeStamp()
          
                  assert.equal(numOfPlayer.toString(), "0")
                  assert.equal(raffleState.toString(), "0")
                  assert(endingTimeStamp > startingTimeStamp)
                  resolve() 
                } catch(e) {
                  reject(e)
                } 
              })
          
              const tx = await raffle.performUpkeep([])
              const txReceipt = await tx.wait(1)
             await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)

            }) 
          })
    })
})