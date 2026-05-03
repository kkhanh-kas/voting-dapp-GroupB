// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {
    /// State Variables
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    mapping(uint => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    uint public candidatesCount;
    address public owner;
    uint public startTime;
    uint public endTime;

    /// Events
    event votedEvent(uint indexed _candidateId);
    event candidateAdded(uint indexed _candidateId, string name);

    /// Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier withinVotingPeriod() {
        require(block.timestamp >= startTime, "Voting has not started yet");
        require(block.timestamp <= endTime, "Voting has ended");
        _;
    }

    /// Constructor
    constructor() {
        owner = msg.sender;
        startTime = block.timestamp;
        endTime = block.timestamp + 1 days;

        _addCandidate("Michael Anderson");
        _addCandidate("Christopher Walker");
        _addCandidate("Daniel Thompson");
        _addCandidate("James Carter");
    }

    /// Internal Function
    function _addCandidate(string memory _name) internal {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
    }

    /// Owner Functions
    function addCandidate(string memory _name) public onlyOwner {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
        emit candidateAdded(candidatesCount, _name);
    }

    function setVotingPeriod(uint _startTime, uint _endTime) public onlyOwner {
        require(_endTime > _startTime, "End time must be after start time");
        startTime = _startTime;
        endTime = _endTime;
    }

    /// Vote Function
    function vote(uint _candidateId) public withinVotingPeriod {
        require(!hasVoted[msg.sender], "You have already voted");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");

        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;

        emit votedEvent(_candidateId);
    }

    function getVotingStatus() public view returns (string memory) {
        if (block.timestamp < startTime) return "NOT_STARTED";
        if (block.timestamp >= startTime && block.timestamp <= endTime) return "ACTIVE";
        return "ENDED";
    }
}
