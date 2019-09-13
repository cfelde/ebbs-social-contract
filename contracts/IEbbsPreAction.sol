pragma solidity ^0.5.0;

/**
 * The below functions are called prior to any action is taken on the related forum function.
 * If the below functions return false no further action is taken by the forum instance.
 */
interface IEbbsPreAction {
    function preCreatePost(address msgSender, uint inReplyTo, bytes calldata postData) external returns (bool approved);

    function preUpdatePost(address msgSender, uint postId, bytes calldata postData) external returns (bool approved);

    function preVote(address msgSender, uint postId, int points) external returns (bool approved);

    function preSetMeta(address msgSender, uint postId, bytes calldata oldMeta, bytes calldata newMeta) external returns (bool approved);

    function preSetAdmin(address msgSender, address admin, uint adminStatus) external returns (bool approved);

    function preSetActive(address msgSender, bool status) external returns (bool approved);

    function preKill(address msgSender) external returns (bool approved);
}
