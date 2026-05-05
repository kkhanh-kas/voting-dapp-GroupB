// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {
    /// State Variables
    struct Candidate {
        uint id;
        string name;
        string bio;
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
    event candidateAdded(uint indexed _candidateId, string name, string bio);
    event candidateUpdated(uint indexed _candidateId, string name, string bio);
    event candidateDeleted(uint indexed _candidateId);

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

        _addCandidate("Michael Anderson", "A seasoned leader with 10 years of experience in decentralized governance. Committed to transparency and community-driven decision making.");
        _addCandidate("Christopher Walker", "Blockchain enthusiast and software engineer. Focuses on building scalable and secure infrastructure for Web3 applications.");
        _addCandidate("Daniel Thompson", "Advocate for privacy rights and open-source technology. Believes in empowering individuals through decentralized tools.");
        _addCandidate("James Carter", "Financial analyst turned crypto researcher. Dedicated to creating sustainable economic models for decentralized ecosystems.");
    }

    /// Internal Function
    function _addCandidate(string memory _name, string memory _bio) internal {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, _bio, 0);
    }

    /// Owner Functions
    function addCandidate(string memory _name, string memory _bio) public onlyOwner {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, _bio, 0);
        emit candidateAdded(candidatesCount, _name, _bio);
    }

    function setVotingPeriod(uint _startTime, uint _endTime) public onlyOwner {
        require(_endTime > _startTime, "End time must be after start time");
        startTime = _startTime;
        endTime = _endTime;
    }

    function updateCandidate(uint _candidateId, string memory _name, string memory _bio) public onlyOwner {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        require(bytes(candidates[_candidateId].name).length > 0, "Candidate does not exist");
        candidates[_candidateId].name = _name;
        candidates[_candidateId].bio = _bio;
        emit candidateUpdated(_candidateId, _name, _bio);
    }

    function deleteCandidate(uint _candidateId) public onlyOwner {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        require(bytes(candidates[_candidateId].name).length > 0, "Candidate does not exist");
        delete candidates[_candidateId];
        emit candidateDeleted(_candidateId);
    }

    /// Vote Function
    function vote(uint _candidateId) public withinVotingPeriod {
        require(!hasVoted[msg.sender], "You have already voted");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        require(bytes(candidates[_candidateId].name).length > 0, "Candidate does not exist");

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
