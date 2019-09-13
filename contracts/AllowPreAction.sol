pragma solidity ^0.5.0;

import "./IEbbsPreAction.sol";

// Test contract that allows all pre actions..
contract AllowPreAction is IEbbsPreAction {
    function preCreatePost(address /* msgSender */, uint /* inReplyTo */, bytes calldata /* postData */) external returns (bool) {
        return true;
    }

    function preUpdatePost(address /* msgSender */, uint /* postId */, bytes calldata /* postData */) external returns (bool) {
        return true;
    }

    function preVote(address /* msgSender */, uint /* postId */, int /* points */) external returns (bool) {
        return true;
    }

    function preSetMeta(address /* msgSender */, uint /* postId */, bytes calldata /* oldMeta */, bytes calldata /* newMeta */) external returns (bool) {
        return true;
    }

    function preSetAdmin(address /* msgSender */, address /* admin */, uint /* adminStatus */) external returns (bool) {
        return true;
    }

    function preSetActive(address /* msgSender */, bool /* status */) external returns (bool) {
        return true;
    }

    function preKill(address /* msgSender */) external returns (bool) {
        return true;
    }
}
