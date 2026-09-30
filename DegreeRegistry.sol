// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Blockchain layer of the diagram: DID registry + degree hash store + revocation status.
contract DegreeRegistry {
    enum Role { None, University, Student, Employer }
    struct Degree { address issuer; address student; uint256 issuedAt; bool revoked; }

    address public regulator;
    mapping(address => Role) public roles;
    mapping(address => string) public didDocument;
    mapping(bytes32 => Degree) public degrees;

    event DIDRegistered(address indexed who, Role role, string doc);
    event DegreeIssued(bytes32 indexed hash, address indexed issuer, address indexed student);
    event DegreeRevoked(bytes32 indexed hash);

    constructor() { regulator = msg.sender; roles[msg.sender] = Role.University; }

    modifier onlyUniversity() { require(roles[msg.sender] == Role.University, "Not a university"); _; }

    function accreditUniversity(address uni, string calldata doc) external {
        require(msg.sender == regulator, "Only regulator");
        roles[uni] = Role.University; didDocument[uni] = doc;
        emit DIDRegistered(uni, Role.University, doc);
    }

    function registerSelf(Role role, string calldata doc) external {
        require(role == Role.Student || role == Role.Employer, "Invalid role");
        require(roles[msg.sender] == Role.None, "Already registered");
        roles[msg.sender] = role; didDocument[msg.sender] = doc;
        emit DIDRegistered(msg.sender, role, doc);
    }

    function issueDegree(bytes32 h, address student) external onlyUniversity {
        require(degrees[h].issuer == address(0), "Already exists");
        require(roles[student] == Role.Student, "Student not registered");
        degrees[h] = Degree(msg.sender, student, block.timestamp, false);
        emit DegreeIssued(h, msg.sender, student);
    }

    function revokeDegree(bytes32 h) external {
        require(degrees[h].issuer == msg.sender, "Not issuer");
        degrees[h].revoked = true;
        emit DegreeRevoked(h);
    }

    function verifyDegree(bytes32 h) external view returns (bool valid, address issuer, address student) {
        Degree memory d = degrees[h];
        valid = d.issuer != address(0) && !d.revoked && roles[d.issuer] == Role.University;
        return (valid, d.issuer, d.student);
    }
}
