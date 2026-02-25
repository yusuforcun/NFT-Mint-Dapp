//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGovernanceToken{
    function balanceOf(address account) external view returns (uint256);
}

contract Voting{
    struct Proposal{
        uint256 id;
        string description ;
        uint256 startTime;
        uint256 endTime;
        uint256 yesVotes;
        uint256 noVotes;
        bool finalized;
    }

    struct VoterInfo{
        bool voted;
        bool support;
        uint256 weight;
    }

    IGovernanceToken public governanceToken ;
    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => VoterInfo))public voterInfo;

    event ProposalCreated(
        uint256 id,
        address indexed proposer,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    event VoteCast (
        uint256 proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    event ProposalFinalized(
        uint256 proposalId,
        bool passed,
        uint256 yesVotes,
        uint256 noVotes
    );
    constructor(address _governanceToken){
        governanceToken = IGovernanceToken(_governanceToken);
    }

    function createProposal(string calldata _description,uint256 _votingPeriod)
    external
    returns(uint256){
        require(_votingPeriod > 0 , "Voting period must be > 0");
        uint256 proposalId = nextProposalId;
        nextProposalId++;

        uint256 start = block.timestamp;
        uint256 end = block.timestamp + _votingPeriod;

        proposals[proposalId] = Proposal({
            id : proposalId,
            description : _description,
            startTime : start,
            endTime : end,
            yesVotes : 0,
            noVotes : 0,
            finalized : false
        });

        emit ProposalCreated(proposalId,msg.sender,_description,start,end);
        return proposalId;
    }

    function vote (uint256 _proposalId , bool _support) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.endTime != 0, "Proposal does not exist");
        require(
            block.timestamp >= proposal.startTime && 
            block.timestamp <= proposal.endTime,
            "Voting is not active"
        );

        VoterInfo storage voter = voterInfo[_proposalId][msg.sender];
        require(!voter.voted,"Already voted");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0 , "No voting power");

        voter.voted = true ;
        voter.support = _support ;
        voter.weight = weight ;

        if (_support){
            proposal.yesVotes += weight;
        }else{
            proposal.noVotes += weight ;
        }
        emit VoteCast (_proposalId , msg.sender ,_support , weight);
    }
    function finalize(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.endTime != 0 , "Proposal does not exist");
        require(block.timestamp > proposal.endTime ,"Voting not ended");
        require(!proposal.finalized , "Already finalized");

        proposal.finalized = true ;
        bool passed = proposal.yesVotes > proposal.noVotes ;

        emit ProposalFinalized(
            _proposalId,
            passed,
            proposal.yesVotes,
            proposal.noVotes
        );

    }

}