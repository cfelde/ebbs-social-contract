pragma solidity ^0.5.0;

import "./IEbbsPreAction.sol";

// Test contract that blocks all pre actions..
contract BlockPreAction is IEbbsPreAction {
    function preCreatePost(address /* msgSender */, uint /* inReplyTo */, bytes calldata /* postData */) external returns (bool) {
        return false;
    }

    function preUpdatePost(address /* msgSender */, uint /* postId */, bytes calldata /* postData */) external returns (bool) {
        return false;
    }

    function preVote(address /* msgSender */, uint /* postId */, int /* points */) external returns (bool) {
        return false;
    }

    function preSetMeta(address /* msgSender */, uint /* postId */, bytes calldata /* oldMeta */, bytes calldata /* newMeta */) external returns (bool) {
        return false;
    }

    function preSetAdmin(address /* msgSender */, address /* admin */, uint /* adminStatus */) external returns (bool) {
        return false;
    }

    function preSetActive(address /* msgSender */, bool /* status */) external returns (bool) {
        return false;
    }

    function preKill(address /* msgSender */) external returns (bool) {
        return false;
    }
}
