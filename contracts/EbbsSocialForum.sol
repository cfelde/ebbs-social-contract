pragma solidity ^0.5.0;

import "./IEbbsSocialForum.sol";
import "./IEbbsPreAction.sol";
import "./IEbbsPostAction.sol";

contract EbbsSocialForum is IEbbsSocialForum {
    uint constant MAX_POST_DATA_LENGTH = 256;
    uint constant MAX_POST_META_LENGTH = 512;

    uint constant MAX_POST_UPDATE_DELAY = 5 minutes;

    int constant MAX_VOTE_POINTS = 1;
    int constant MIN_VOTE_POINTS = -1;

    struct Post {
        address author;

        uint timestamp;
        uint inReplyTo;

        uint replyCounter;
        int pointCounter;

        bytes postData;
        bytes postMeta;
    }

    uint private nextPostId;
    uint private nextAdminId;

    mapping (uint => Post) private posts;
    mapping (uint => mapping (address => int)) private votes;
    mapping (address => int) private authorPoints;

    // Admins mapping store an uint used to indicate what capabilities a user has:

    // * First bit (LSB) is set if user is admin
    // * Second bit is set if user is moderator

    // Remaining bits currently unassigned..

    mapping (address => uint) private admins;
    mapping (address => uint) private adminIndex;
    mapping (uint => address) private indexAdmin;

    address private preActionAddress;
    address private postActionAddress;

    bool private active;

    modifier onlyAdmin {
        require((admins[msg.sender] & 0x1) == 0x1, "Only admins can call this function.");

        _;
    }

    modifier onlyMod {
        require((admins[msg.sender] & 0x2) == 0x2, "Only moderators can call this function.");

        _;
    }

    constructor(bytes memory postData, bytes memory postMeta, bool initActive) public {
        require(postData.length <= MAX_POST_DATA_LENGTH, "postData too large");
        require(postMeta.length <= MAX_POST_META_LENGTH, "postMeta too large");

        // Make msg.sender admin + moderator
        admins[msg.sender] = 0x1 | 0x2;
        adminIndex[msg.sender] = nextAdminId;
        indexAdmin[nextAdminId] = msg.sender;
        nextAdminId++;

        // We use inReplyTo = 0 as a special case for a post not in reply to anything.
        // So put constructor post as post zero, with also acts as forum configuration..
        Post memory postZero;

        postZero.author = address(this);
        postZero.timestamp = block.timestamp;
        postZero.postData = postData;
        postZero.postMeta = postMeta;
        postZero.pointCounter = 1;

        uint postId = nextPostId++;

        posts[postId] = postZero;
        votes[postId][msg.sender] = 1;
        authorPoints[msg.sender]++;

        active = initActive;

        emit Posted(address(this), address(0), 0, postId, postData, postMeta);
    }

    // Non-interface functions
    function getPreActionAddress() external view returns (address) {
        return preActionAddress;
    }

    function setPreActionAddress(address contractAddress) external onlyAdmin {
        preActionAddress = contractAddress;
    }

    function getPostActionAddress() external view returns (address) {
        return postActionAddress;
    }

    function setPostActionAddress(address contractAddress) external onlyAdmin {
        postActionAddress = contractAddress;
    }

    // IEbbsSocialForum interface functions
    function getEbbsVersion() external pure returns (uint) {
        return 1;
    }

    function getPostCount() external view returns (uint) {
        return nextPostId;
    }

    function createPost(uint inReplyTo, bytes calldata postData) external returns (uint postId) {
        require(active || admins[msg.sender] > 0, "Not active");
        require(inReplyTo < nextPostId, "Invalid inReplyTo");
        require(postData.length <= MAX_POST_DATA_LENGTH, "postData too large");
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preCreatePost(msg.sender, inReplyTo, postData), "Pre-action failure");

        Post memory newPost;

        newPost.author = msg.sender;
        newPost.timestamp = block.timestamp;
        newPost.inReplyTo = inReplyTo;
        newPost.postData = postData;
        newPost.pointCounter = 1;

        postId = nextPostId++;
        posts[postId] = newPost;

        votes[postId][msg.sender] = 1;
        authorPoints[msg.sender]++;

        posts[inReplyTo].replyCounter++;

        emit Posted(msg.sender, posts[inReplyTo].author, inReplyTo, postId, postData, newPost.postMeta);

        if (postActionAddress != address(0)) {
            IEbbsPostAction(postActionAddress).postCreatePost(msg.sender, inReplyTo, postData);
        }
    }

    function updatePost(uint postId, bytes calldata postData) external returns (bool) {
        require(active || admins[msg.sender] > 0, "Not active");
        require(postId < nextPostId, "Invalid postId");
        require(postData.length <= MAX_POST_DATA_LENGTH, "postData too large");
        require(msg.sender == posts[postId].author || (postId == 0 && admins[msg.sender] & 0x1 == 0x1), "Invalid author");
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preUpdatePost(msg.sender, postId, postData), "Pre-action failure");

        if ((msg.sender == posts[postId].author && posts[postId].timestamp >= block.timestamp - MAX_POST_UPDATE_DELAY) || (postId == 0 && admins[msg.sender] & 0x1 == 0x1)) {
            posts[postId].postData = postData;
            posts[postId].timestamp = block.timestamp;

            uint inReplyTo = posts[postId].inReplyTo;

            emit Posted(posts[postId].author, posts[inReplyTo].author, posts[postId].inReplyTo, postId, postData, posts[postId].postMeta);

            if (postActionAddress != address(0)) {
                IEbbsPostAction(postActionAddress).postUpdatePost(msg.sender, postId, postData);
            }

            return true;
        }

        return false;
    }

    function getPost(uint postId) external view returns (
            address author,
            uint timestamp,
            uint inReplyTo,
            uint replyCounter,
            int pointCounter,
            bytes memory postData,
            bytes memory postMeta) {
        require(postId < nextPostId, "Invalid postId");

        author = posts[postId].author;
        timestamp = posts[postId].timestamp;
        inReplyTo = posts[postId].inReplyTo;
        replyCounter = posts[postId].replyCounter;
        pointCounter = posts[postId].pointCounter;
        postData = posts[postId].postData;
        postMeta = posts[postId].postMeta;
    }

    function vote(uint postId, int points) external returns (int newPointCounter) {
        require(active || admins[msg.sender] > 0, "Not active");
        require(points >= MIN_VOTE_POINTS, "Vote points outside range");
        require(points <= MAX_VOTE_POINTS, "Vote points outside range");
        require(postId < nextPostId, "Invalid postId");
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preVote(msg.sender, postId, points), "Pre-action failure");

        int oldVote = votes[postId][msg.sender];
        int diff = points - oldVote;

        if (diff > 0 || diff < 0) {
            votes[postId][msg.sender] = points;
            posts[postId].pointCounter += diff;
            authorPoints[posts[postId].author] += diff;

            newPointCounter = posts[postId].pointCounter;

            emit Voted(msg.sender, postId, points, diff, newPointCounter);

            if (postActionAddress != address(0)) {
                IEbbsPostAction(postActionAddress).postVote(msg.sender, postId, points);
            }
        } else {
            newPointCounter = posts[postId].pointCounter;
        }
    }

    function getVoteOnPost(uint postId, address voter) external view returns (int points) {
        points = votes[postId][voter];
    }

    function getAuthorPoints(address author) external view returns (int points) {
        points = authorPoints[author];
    }

    function setMeta(uint postId, bytes calldata oldMeta, bytes calldata newMeta) external onlyMod {
        require(postId < nextPostId, "Invalid postId");
        require(newMeta.length <= MAX_POST_META_LENGTH, "newMeta too large");
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preSetMeta(msg.sender, postId, oldMeta, newMeta), "Pre-action failure");

        bytes memory existingMeta = posts[postId].postMeta;

        require(existingMeta.length == oldMeta.length, "Existing meta and old meta length mismatch");

        for (uint i = 0; i < existingMeta.length; i++) {
            require(existingMeta[i] == oldMeta[i], "Existing meta and old meta content mismatch");
        }

        posts[postId].postMeta = newMeta;

        uint inReplyTo = posts[postId].inReplyTo;

        emit Posted(posts[postId].author, posts[inReplyTo].author, posts[postId].inReplyTo, postId, posts[postId].postData, newMeta);

        if (postActionAddress != address(0)) {
            IEbbsPostAction(postActionAddress).postSetMeta(msg.sender, postId, oldMeta, newMeta);
        }
    }

    function isAdmin(address admin) external view returns (uint) {
        return admins[admin];
    }

    function setAdmin(address admin, uint adminStatus) external onlyAdmin {
        require(msg.sender != admin, "You cannot modify yourself");
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preSetAdmin(msg.sender, admin, adminStatus), "Pre-action failure");

        // Remove existing mapping if needed..
        if (admins[admin] > 0) {
            uint index = adminIndex[admin];
            uint lastIndex = nextAdminId - 1;

            if (index != lastIndex) {
                address swap = indexAdmin[lastIndex];

                indexAdmin[index] = swap;
                adminIndex[swap] = index;
            }

            nextAdminId--;
        }

        admins[admin] = adminStatus;

        // Index new mapping if needed..
        if (adminStatus > 0) {
            adminIndex[admin] = nextAdminId;
            indexAdmin[nextAdminId] = admin;
            nextAdminId++;
        }

        emit ChangedAdmin(msg.sender, admin, adminStatus);

        if (postActionAddress != address(0)) {
            IEbbsPostAction(postActionAddress).postSetAdmin(msg.sender, admin, adminStatus);
        }
    }

    function getAdminCount() external view returns (uint) {
        return nextAdminId;
    }

    function getAdmin(uint index) external view returns (address) {
        return indexAdmin[index];
    }

    function isActive() external view returns (bool) {
        return active;
    }

    function setActive(bool status) external onlyAdmin {
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preSetActive(msg.sender, status), "Pre-action failure");

        active = status;

        if (postActionAddress != address(0)) {
            IEbbsPostAction(postActionAddress).postSetActive(msg.sender, status);
        }
    }

    function kill() external onlyAdmin {
        require(preActionAddress == address(0) || IEbbsPreAction(preActionAddress).preKill(msg.sender), "Pre-action failure");

        selfdestruct(msg.sender);
    }
}
