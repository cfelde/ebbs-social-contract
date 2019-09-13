pragma solidity ^0.5.0;

import "./IEbbsPostAction.sol";

// Test contract that does nothing on post actions..
contract NullPostAction is IEbbsPostAction {
    function postCreatePost(address /* msgSender */, uint /* inReplyTo */, bytes calldata /* postData */) external {
    }

    function postUpdatePost(address /* msgSender */, uint /* postId */, bytes calldata /* postData */) external {
    }

    function postVote(address /* msgSender */, uint /* postId */, int /* points */) external {
    }

    function postSetMeta(address /* msgSender */, uint /* postId */, bytes calldata /* oldMeta */, bytes calldata /* newMeta */) external {
    }

    function postSetAdmin(address /* msgSender */, address /* admin */, uint /* adminStatus */) external {
    }

    function postSetActive(address /* msgSender */, bool /* status */) external {
    }
}
