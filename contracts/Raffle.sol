// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Raffle__sentMoreToEnterRaffle();
error Raffle__upKeepNotNeed(uint256 currentBalance, uint256 numOfPlayers, uint256 raffleState);
error Raffle__raffleNotOpen();
error Raffle__TransferFailed();

/**
 * @title A sample Raffle contract
 * @author Shurjeel Khan
 * @notice This contract is for creating a sample raffle contract
 * @dev This implements the Chainlink VRF Version 2
 */

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* Type declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    } // uint256 0 = OPEN, 1 = CALCULATING 
    
    /* State Variable */
    // Chainlink VRF Variable
    VRFCoordinatorV2Interface private immutable i_vrfCordinator;
    uint256 private immutable i_entranceFee;
    uint64 private immutable i_subscriptionId;
    uint16 private immutable i_callbackGasLimit;
    bytes32 private immutable i_gasLane;
    uint32 private constant NUM_WORDS = 1;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;

    // Lottery Variables
    address payable[] private s_players;
    address private s_recentWinner;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;
    RaffleState private s_raffleState;

    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed recentWinner);
    
    /* Functions */
    constructor(
    address vrfCordinatorV2,
    uint64 subscriptionId,
    uint256 entranceFee,
    bytes32 gasLane,
    uint16 callbackGasLimit,
    uint256 interval
    ) VRFConsumerBaseV2(vrfCordinatorV2){
        i_entranceFee = entranceFee;
        i_vrfCordinator = VRFCoordinatorV2Interface(vrfCordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__sentMoreToEnterRaffle();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__raffleNotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

     /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
    function checkUpkeep( bytes memory /* checkData */) public override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = RaffleState.OPEN == s_raffleState;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasBalance = address(this).balance > 0;
        bool hasPlayer = s_players.length > 0;
        upkeepNeeded = (isOpen && timePassed && hasBalance && hasPlayer);
        return (upkeepNeeded, "0x0");
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__upKeepNotNeed(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
          uint256 requestId = i_vrfCordinator.requestRandomWords(
            i_gasLane, // keyHash
            i_subscriptionId,
            i_callbackGasLimit,
            REQUEST_CONFIRMATIONS,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

          function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* View / Pure Functions */
    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getNumOfPlayers() public view returns(uint256) {
        return s_players.length;
    }

    function getRaffleState() public view returns(RaffleState) {
        return s_raffleState;
    }

    function getLastTimeStamp() public view returns(uint256) {
        return s_lastTimeStamp;
    }

    function getRequestedConfirmation() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS;
    }

    function getInterval() public view returns(uint256) {
        return i_interval;
    }
}