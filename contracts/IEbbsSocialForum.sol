pragma solidity ^0.5.0;

/**
 * @author cfelde
 * @title EBBS social forum interface
 */
interface IEbbsSocialForum {
    /**
     * Returns the interface version a contract implements.
     */
    function getEbbsVersion() external pure returns (uint ebbsVersion);

    /**
     * Returns number of posts stored in forum.
     */
    function getPostCount() external view returns (uint postCount);

    /**
     * Used for creating a new post. If the post is in reply to another post this is specified by
     * the post id of the post you want to reply to. Otherwise inReplyTo should be zero.
     *
     * @param inReplyTo Zero or post id on which we're replying.
     * @param postData Deflated serialized JSON object.
     * @dev Details on the formatting of postData can be found on https://github.com/cfelde/ebbs-social
     * @return The post id of the newly created post.
     */
    function createPost(uint inReplyTo, bytes calldata postData) external returns (uint postId);

    /**
     * Used for updating an existing post.
     *
     * @param postId Post id of post we wish to update.
     * @param postData Deflated serialized JSON object.
     * @dev Details on the formatting of postData can be found on https://github.com/cfelde/ebbs-social
     * @return The post id of the newly created post.
     */
    function updatePost(uint postId, bytes calldata postData) external returns (bool updated);


    /**
     * Return available data on given post id.
     *
     * @param postId Post id to query on.
     * @return Details on requested post.
     */
    function getPost(uint postId) external view returns (
        address author,
        uint timestamp,
        uint inReplyTo,
        uint replyCounter,
        int pointCounter,
        bytes memory postData,
        bytes memory postMeta);

    /**
     * Used for voting on a given post id.
     *
     * @param postId Post id we're voting on.
     * @param points How many points to allocate on post.
     * @dev An implementation will limit the range on points.
     * @return New sum of post points.
     */
    function vote(uint postId, int points) external returns (int newPointCounter);

    /**
     * Obtain the points given to a post by a given voter.
     *
     * @param postId Post id we're interested in.
     * @param voter Address of voter we're interested in.
     * @return Points given by voter on postId, or zero.
     */
    function getVoteOnPost(uint postId, address voter) external view returns (int points);

    /**
     * Total points, aka karma, on a specified author address.
     *
     * @param author Author address.
     * @return Sum of all points given to author.
     */
    function getAuthorPoints(address author) external view returns (int points);

    /**
     * Set meta on a post. Meta is used for admin purposes.
     *
     * @param postId Post id we're interested in.
     * @param oldMeta This value must match the existing post meta value
     * @param newMeta New meta data we want to set.
     * @dev The primary purpose of specifying oldMeta is to provide some level of optimistic locking.
     */
    function setMeta(uint postId, bytes calldata oldMeta, bytes calldata newMeta) external;

    /**
     * Check the admin status of a given address. Return value follows:
     *
     * First bit (LSB) is set if user is admin
     * Second bit is set if user is moderator
     *
     * @param admin Address to obtain admin status for.
     * @return Admin status bits
     */
    function isAdmin(address admin) external view returns (uint adminStatus);

    /**
     * Set the admin status of a given address. Admin status value follows:
     *
     * First bit (LSB) is set if user is admin
     * Second bit is set if user is moderator
     *
     * @param admin Address to obtain admin status for.
     * @param adminStatus Value of admin status
     */
    function setAdmin(address admin, uint adminStatus) external;

    /**
     * @return Number of current admins.
     */
    function getAdminCount() external view returns (uint count);

    /**
     * @param index Index offset to obtain.
     * @return Admin address at given index.
     */
    function getAdmin(uint index) external view returns (address admin);

    /**
     * To check if this forum is active. A deactivated forum is in read-only mode for normal users.
     *
     * @return State of the active flag.
     */
    function isActive() external view returns (bool active);

    /**
     * Change the state of the active flag.
     *
     * @param status Set to false to deactivate forum, true to active forum.
     */
    function setActive(bool status) external;

    /**
     * Kill this forum instance. THIS IS PERMANENT.
     */
    function kill() external;

    event Posted(address indexed author, address indexed inReplyToAddress, uint indexed inReplyTo, uint postId, bytes postData, bytes postMeta);
    event Voted(address indexed voter, uint indexed postId, int points, int diff, int newTotalPoints);
    event ChangedAdmin(address indexed operator, address indexed changedAdmin, uint adminStatus);
}
