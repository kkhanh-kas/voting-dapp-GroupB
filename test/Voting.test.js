const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting", function () {
  let voting;
  let owner;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
  });

  it("initializes with correct candidate count", async function () {
    const count = await voting.candidatesCount();
    expect(count).to.equal(4n);
  });

  it("each candidate has correct initial data", async function () {
    const names = [
      "Michael Anderson",
      "Christopher Walker",
      "Daniel Thompson",
      "James Carter",
    ];

    for (let i = 0; i < names.length; i++) {
      const candidate = await voting.candidates(i + 1);
      expect(candidate.id).to.equal(BigInt(i + 1));
      expect(candidate.name).to.equal(names[i]);
      expect(candidate.voteCount).to.equal(0n);
    }
  });

  it("a valid vote increments voteCount by 1", async function () {
    await voting.connect(voter1).vote(1);
    const candidate = await voting.candidates(1);
    expect(candidate.voteCount).to.equal(1n);
  });

  it("reverts when voting with invalid candidateId", async function () {
    await expect(voting.connect(voter1).vote(0)).to.be.revertedWith(
      "Invalid candidate ID"
    );
    await expect(voting.connect(voter1).vote(99)).to.be.revertedWith(
      "Invalid candidate ID"
    );
  });

  it("reverts when voting twice from the same address", async function () {
    await voting.connect(voter1).vote(1);
    await expect(voting.connect(voter1).vote(2)).to.be.revertedWith(
      "You have already voted"
    );
  });

  it("emits votedEvent with correct candidateId", async function () {
    await expect(voting.connect(voter1).vote(2))
      .to.emit(voting, "votedEvent")
      .withArgs(2n);
  });

  describe("Admin Candidate Management", function () {
    it("updates candidate name and bio correctly", async function () {
      await voting.connect(owner).updateCandidate(1, "Updated Name", "Updated Bio");
      const candidate = await voting.candidates(1);
      expect(candidate.name).to.equal("Updated Name");
      expect(candidate.bio).to.equal("Updated Bio");
    });

    it("reverts when non-owner tries to update candidate", async function () {
      await expect(
        voting.connect(voter1).updateCandidate(1, "Updated Name", "Updated Bio")
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("reverts when updating an invalid or deleted candidate", async function () {
      await expect(
        voting.connect(owner).updateCandidate(99, "Name", "Bio")
      ).to.be.revertedWith("Invalid candidate ID");

      await voting.connect(owner).deleteCandidate(1);
      await expect(
        voting.connect(owner).updateCandidate(1, "Name", "Bio")
      ).to.be.revertedWith("Candidate does not exist");
    });

    it("deletes a candidate by zeroing out the struct", async function () {
      await voting.connect(owner).deleteCandidate(2);
      const candidate = await voting.candidates(2);
      expect(candidate.id).to.equal(0n);
      expect(candidate.name).to.equal("");
      expect(candidate.bio).to.equal("");
      expect(candidate.voteCount).to.equal(0n);
    });

    it("reverts when non-owner tries to delete candidate", async function () {
      await expect(voting.connect(voter1).deleteCandidate(1)).to.be.revertedWith(
        "Only owner can call this function"
      );
    });

    it("reverts when voting for a deleted candidate", async function () {
      await voting.connect(owner).deleteCandidate(3);
      await expect(voting.connect(voter1).vote(3)).to.be.revertedWith(
        "Candidate does not exist"
      );
    });
  });
});
