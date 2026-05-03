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
});
