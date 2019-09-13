const EbbsSocialForum = artifacts.require("EbbsSocialForum");
const AllowPreAction = artifacts.require("AllowPreAction");
const BlockPreAction = artifacts.require("BlockPreAction");
const NullPostAction = artifacts.require("NullPostAction");

function stringToBytes(str) {
    var ch, st, re = [];

    for (var i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);
        st = [];
        do {
            st.push( ch & 0xFF );
            ch = ch >> 8;
        } while (ch);

        re = re.concat(st.reverse());
    }

    return re;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

contract("When testing EbbsSocialForum, it:", async accounts => {
    it("should start with a valid initial state", async () => {
        let instance = await EbbsSocialForum.deployed();

        // Contract can be non-active when created, which allows the admin to
        // configure the forum before anyone else can interact with it..
        assert.isFalse(await instance.isActive());
        await instance.setActive(true);
        assert.isTrue(await instance.isActive());

        // This is optional
        await instance.setPreActionAddress((await AllowPreAction.deployed()).address);

        // This is optional
        await instance.setPostActionAddress((await NullPostAction.deployed()).address);

        let ebbsVersion = (await instance.getEbbsVersion()).toNumber();
        assert.equal(ebbsVersion, 1);

        let postCount = (await instance.getPostCount()).toNumber();
        assert.equal(postCount, 1);

        let postZero = (await instance.getPost(0));

        assert.equal(postZero.author, instance.address);
        assert.isTrue(postZero.timestamp > 0);
        assert.equal(postZero.inReplyTo.toNumber(), 0);
        assert.equal(postZero.replyCounter.toNumber(), 0);
        assert.equal(postZero.pointCounter.toNumber(), 1);
        assert.deepEqual(web3.utils.hexToBytes(postZero.postData), stringToBytes("123"));
        assert.isNull(postZero.postMeta);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
    });

    it("should allow author to update a fresh post", async () => {
        let instance = await EbbsSocialForum.deployed();

        let existingTimestamp = ((await instance.getPost(0))).timestamp;

        await sleep(1000);

        await instance.updatePost(0, stringToBytes("1234"));

        let postZero = (await instance.getPost(0));

        assert.isTrue(postZero.timestamp > existingTimestamp);
        assert.deepEqual(web3.utils.hexToBytes(postZero.postData), stringToBytes("1234"));

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
    });

    it("should not allow someone else to update a fresh post", async () => {
        let instance = await EbbsSocialForum.deployed();

        let gotEx = false;
        try {
            await instance.updatePost(0, stringToBytes("12345"), {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        let postZero = (await instance.getPost(0));

        assert.deepEqual(web3.utils.hexToBytes(postZero.postData), stringToBytes("1234"));
    });

    it("should allow any admin to update post zero", async () => {
        let instance = await EbbsSocialForum.deployed();

        await instance.setAdmin(accounts[1], 1);

        assert.equal(await instance.isAdmin(accounts[1]), 1);

        let existingTimestamp = ((await instance.getPost(0))).timestamp;

        await sleep(1000);

        await instance.updatePost(0, stringToBytes("12345"), {from: accounts[1]});

        let postZero = (await instance.getPost(0));

        assert.isTrue(postZero.timestamp > existingTimestamp);
        assert.deepEqual(web3.utils.hexToBytes(postZero.postData), stringToBytes("12345"));
        assert.equal(postZero.author, instance.address);

        await instance.setAdmin(accounts[1], 0);

        let gotEx = false;
        try {
            // Use account 2 because account 1 is now author
            await instance.updatePost(0, stringToBytes("123456"), {from: accounts[2]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);
        assert.deepEqual(web3.utils.hexToBytes(postZero.postData), stringToBytes("12345"));
    });

    it("should be possible to create a new post", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal(await instance.getAuthorPoints(accounts[1]), 0);

        await instance.createPost(0, stringToBytes("Hello World!"), {from: accounts[1]});

        let postCount = (await instance.getPostCount()).toNumber();
        assert.equal(postCount, 2);

        let postOne = (await instance.getPost(1));

        assert.equal(postOne.author, accounts[1]);
        assert.isTrue(postOne.timestamp > 0);
        assert.equal(postOne.inReplyTo.toNumber(), 0);
        assert.equal(postOne.replyCounter.toNumber(), 0);
        assert.equal(postOne.pointCounter.toNumber(), 1);
        assert.deepEqual(web3.utils.hexToBytes(postOne.postData), stringToBytes("Hello World!"));
        assert.isNull(postOne.postMeta);

        assert.equal((await instance.getPost(0)).replyCounter.toNumber(), 1);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 1);
    });

    it("should be possible to create a large post", async () => {
        let bigdata = [];
        let i = 0;
        while (bigdata.length < 256) {
            bigdata.push(i++);
            if (i > 128) i = 0;
        }

        let instance = await EbbsSocialForum.deployed();

        await instance.createPost(0, bigdata, {from: accounts[1]});

        let postCount = (await instance.getPostCount()).toNumber();
        assert.equal(postCount, 3);

        let postTwo = (await instance.getPost(2));

        assert.deepEqual(web3.utils.hexToBytes(postTwo.postData), bigdata);
        assert.equal((await instance.getPost(0)).replyCounter.toNumber(), 2);
    });

    it("should not be possible to create a post too large", async () => {
        let bigdata = [];
        let i = 0;
        while (bigdata.length < 257) {
            bigdata.push(i++);
            if (i > 128) i = 0;
        }

        let instance = await EbbsSocialForum.deployed();

        let gotEx = false;
        try {
            await instance.createPost(0, bigdata, {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        let postCount = (await instance.getPostCount()).toNumber();
        assert.equal(postCount, 3);

        assert.equal((await instance.getPost(0)).replyCounter.toNumber(), 2);
    });

    it("should be possible to update a large post", async () => {
        let bigdata = [];
        let i = 1;
        while (bigdata.length < 256) {
            bigdata.push(i++);
            if (i > 128) i = 0;
        }

        let instance = await EbbsSocialForum.deployed();

        await instance.updatePost(2, bigdata, {from: accounts[1]});

        let postCount = (await instance.getPostCount()).toNumber();
        assert.equal(postCount, 3);

        let postTwo = (await instance.getPost(2));

        assert.deepEqual(web3.utils.hexToBytes(postTwo.postData), bigdata);
        assert.equal((await instance.getPost(0)).replyCounter.toNumber(), 2);
    });

    it("should not be possible to update a post too large", async () => {
        let bigdata = [];
        let i = 1;
        while (bigdata.length < 257) {
            bigdata.push(i++);
            if (i > 128) i = 0;
        }

        let instance = await EbbsSocialForum.deployed();

        let existingData = web3.utils.hexToBytes((await instance.getPost(2)).postData);

        let gotEx = false;
        try {
            await instance.updatePost(2, bigdata, {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        let postTwo = (await instance.getPost(2));

        assert.deepEqual(web3.utils.hexToBytes(postTwo.postData), existingData);
        assert.notDeepEqual(web3.utils.hexToBytes(postTwo.postData), bigdata);
        assert.equal((await instance.getPost(0)).replyCounter.toNumber(), 2);
    });

    it("should be possible to vote on a post", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 2);

        assert.equal(await instance.getVoteOnPost(1, accounts[0]), 0);

        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 1);

        // voting zero has no impact unless it removed a previous point given
        await instance.vote(1, 0, {from: accounts[0]});

        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 1);
        assert.equal(await instance.getVoteOnPost(1, accounts[0]), 0);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 2);

        await instance.vote(1, 1, {from: accounts[0]});
        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 2);
        assert.equal(await instance.getVoteOnPost(1, accounts[0]), 1);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 3);

        // No impact because same points as above
        await instance.vote(1, 1, {from: accounts[0]});
        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 2);
        assert.equal(await instance.getVoteOnPost(1, accounts[0]), 1);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 3);

        // Remove your vote by voting zero
        await instance.vote(1, 0, {from: accounts[0]});
        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 1);
        assert.equal(await instance.getVoteOnPost(1, accounts[0]), 0);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 2);

        // Down vote
        await instance.vote(1, -1, {from: accounts[0]});
        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 0);
        assert.equal(await instance.getVoteOnPost(1, accounts[0]), -1);

        assert.equal(await instance.getAuthorPoints(accounts[0]), 1);
        assert.equal(await instance.getAuthorPoints(accounts[1]), 1);
    });

    it("should only be possible to vote within limits", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 0);

        let gotEx = false;
        try {
            await instance.vote(1, 2, {from: accounts[3]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 0);

        gotEx = false;
        try {
            await instance.vote(1, -2, {from: accounts[3]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.equal((await instance.getPost(1)).pointCounter.toNumber(), 0);
    });

    it("should be possible to add and remove admins", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal(await instance.isAdmin(accounts[0]), 3);
        assert.equal(await instance.isAdmin(accounts[1]), 0);

        await instance.setAdmin(accounts[1], 1);

        assert.equal(await instance.isAdmin(accounts[0]), 3);
        assert.equal(await instance.isAdmin(accounts[1]), 1);

        await instance.setAdmin(accounts[1], 0);

        assert.equal(await instance.isAdmin(accounts[0]), 3);
        assert.equal(await instance.isAdmin(accounts[1]), 0);
    });

    it("should not be possible for non-admins to change admins", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal(await instance.isAdmin(accounts[0]), 3);
        assert.equal(await instance.isAdmin(accounts[1]), 0);

        let gotEx = false;
        try {
            await instance.setAdmin(accounts[1], 2, {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.equal(await instance.isAdmin(accounts[0]), 3);
        assert.equal(await instance.isAdmin(accounts[1]), 0);

        gotEx = false;
        try {
            await instance.setAdmin(accounts[1], 0, {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.equal(await instance.isAdmin(accounts[0]), 3);
        assert.equal(await instance.isAdmin(accounts[1]), 0);
    });

    it("should be possible for admins to set post meta", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.isNull((await instance.getPost(1)).postMeta);

        await instance.setMeta(1, stringToBytes(""), stringToBytes("meta1"));

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), stringToBytes("meta1"));

        await instance.setMeta(1, stringToBytes("meta1"), stringToBytes("meta2"));

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), stringToBytes("meta2"));
    });

    it("should be possible for a moderator to set post meta", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal(await instance.isAdmin(accounts[1]), 0);

        await instance.setAdmin(accounts[1], 2);

        assert.equal(await instance.isAdmin(accounts[1]), 2);

        let oldMeta = web3.utils.hexToBytes((await instance.getPost(1)).postMeta);

        await instance.setMeta(1, oldMeta, stringToBytes("metaMod1"), {from: accounts[1]});

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), stringToBytes("metaMod1"));

        await instance.setAdmin(accounts[1], 0);

        assert.equal(await instance.isAdmin(accounts[1]), 0);

        let gotEx = false;
        try {
            await instance.setMeta(1, stringToBytes("metaMod1"), stringToBytes("metaMod2"), {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);
    });

    it("should not be possible to set post meta if old meta has mismatch", async () => {
        let instance = await EbbsSocialForum.deployed();

        let existingMeta = web3.utils.hexToBytes((await instance.getPost(1)).postMeta);

        let gotEx = false;
        try {
            // Fail if old data mismatch
            await instance.setMeta(1, stringToBytes("wrong old meta data"), stringToBytes("new meta"));
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), existingMeta);
    });

    it("should be possible for admins to set a large post meta", async () => {
        let bigdata = [];
        let i = 0;
        while (bigdata.length < 512) {
            bigdata.push(i++);
            if (i > 128) i = 0;
        }

        let instance = await EbbsSocialForum.deployed();

        await instance.setMeta(1, web3.utils.hexToBytes((await instance.getPost(1)).postMeta), bigdata);

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), bigdata);
    });

    it("should not be possible for admins to set a too large post meta", async () => {
        let bigdata = [];
        let i = 0;
        while (bigdata.length < 513) {
            bigdata.push(i++);
            if (i > 128) i = 0;
        }

        let instance = await EbbsSocialForum.deployed();

        let existingMeta = web3.utils.hexToBytes((await instance.getPost(1)).postMeta);

        let gotEx = false;
        try {
            await instance.setMeta(1, existingMeta, bigdata);
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), existingMeta);
    });

    it("should not be possible for non-admins to set post meta", async () => {
        let instance = await EbbsSocialForum.deployed();

        let existingMeta = web3.utils.hexToBytes((await instance.getPost(1)).postMeta);

        let gotEx = false;
        try {
            await instance.setMeta(1, existingMeta, stringToBytes("meta hack"), {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.deepEqual(web3.utils.hexToBytes((await instance.getPost(1)).postMeta), existingMeta);
    });

    it("should be possible for admins to deactivate a contract prohibiting new posts and votes from non-admins", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.isTrue((await instance.isActive()));

        await instance.setActive(false);

        assert.isFalse((await instance.isActive()));

        let gotEx = false;
        try {
            await instance.createPost(0, stringToBytes("Hello World!"), {from: accounts[5]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        try {
            await instance.updatePost(0, stringToBytes("Hello World!"), {from: accounts[5]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        await instance.setActive(true);

        assert.isTrue((await instance.isActive()));

        let postCount = (await instance.getPostCount()).toNumber();

        await instance.createPost(0, stringToBytes("Hello World!"));
        await instance.updatePost(0, stringToBytes("Hello World!"));

        assert.equal(postCount + 1, (await instance.getPostCount()).toNumber());
    });

    it("should not be possible for non-admins to deactivate a contract", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.isTrue((await instance.isActive()));

        let gotEx = false;
        try {
            await instance.setActive(false, {from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.isTrue((await instance.isActive()));
    });

    // it("should not allow author to update an older post", async () => {
    //     let instance = await EbbsSocialForum.deployed();
    //
    //     // This sleep needs to wait as long as is defined in MAX_POST_UPDATE_DELAY,
    //     // which might cause test issues normally..
    //     await sleep(1000 * 60 * 1);
    //
    //     let postOne = (await instance.getPost(1));
    //
    //     let existingTimestamp = postOne.timestamp.toNumber();
    //     let existingValue = web3.utils.hexToBytes(postOne.postData);
    //
    //     assert.equal(postOne.author, accounts[1]);
    //
    //     await instance.updatePost(1, stringToBytes("should not work"), {from: accounts[1]});
    //
    //     postOne = (await instance.getPost(1));
    //
    //     assert.equal(postOne.timestamp.toNumber(), existingTimestamp);
    //     assert.deepEqual(web3.utils.hexToBytes(postOne.postData), existingValue);
    // });
    //
    // it("should allow an admin to update an older post zero", async () => {
    //     let instance = await EbbsSocialForum.deployed();
    //
    //     // This sleep needs to wait as long as is defined in MAX_POST_UPDATE_DELAY,
    //     // which might cause test issues normally..
    //     await sleep(1000 * 60 * 1);
    //
    //     let postZero = (await instance.getPost(0));
    //
    //     assert.equal(postZero.author, instance.address);
    //
    //     let existingTimestamp = postZero.timestamp.toNumber();
    //     let existingValue = web3.utils.hexToBytes(postZero.postData);
    //
    //     await instance.setAdmin(accounts[2], 3);
    //     await instance.updatePost(0, stringToBytes("should work"), {from: accounts[2]});
    //     await instance.setAdmin(accounts[2], 0);
    //
    //     postZero = (await instance.getPost(0));
    //
    //     assert.equal(postZero.author, instance.address);
    //     assert.isTrue(postZero.timestamp.toNumber() > existingTimestamp);
    //     assert.notDeepEqual(web3.utils.hexToBytes(postZero.postData), existingValue);
    //     assert.deepEqual(web3.utils.hexToBytes(postZero.postData), stringToBytes("should work"));
    // });

    it("should not be possible for non-admins to kill a contract", async () => {
        let instance = await EbbsSocialForum.deployed();

        let gotEx = false;
        try {
            await instance.kill({from: accounts[1]});
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        assert.isTrue((await instance.isActive()));
    });

    it("should be easy to track who is admin", async () => {
        let instance = await EbbsSocialForum.deployed();

        assert.equal(await instance.getAdminCount(), 1);

        assert.equal(await instance.getAdmin(0), accounts[0]);
        assert.equal(await instance.isAdmin(accounts[0]), 3);

        await instance.setAdmin(accounts[1], 3);

        assert.equal(await instance.getAdminCount(), 2);

        assert.equal(await instance.getAdmin(0), accounts[0]);
        assert.equal(await instance.getAdmin(1), accounts[1]);
        assert.equal(await instance.isAdmin(accounts[1]), 3);

        await instance.setAdmin(accounts[0], 2, {from: accounts[1]});

        assert.equal(await instance.getAdminCount(), 2);

        assert.equal(await instance.getAdmin(0), accounts[1]);
        assert.equal(await instance.getAdmin(1), accounts[0]);
        assert.equal(await instance.isAdmin(accounts[0]), 2);

        await instance.setAdmin(accounts[0], 0, {from: accounts[1]});

        assert.equal(await instance.getAdminCount(), 1);

        assert.equal(await instance.getAdmin(0), accounts[1]);

        await instance.setAdmin(accounts[0], 3, {from: accounts[1]});

        assert.equal(await instance.getAdminCount(), 2);

        assert.equal(await instance.getAdmin(0), accounts[1]);
        assert.equal(await instance.getAdmin(1), accounts[0]);
    });

    it("should be possible to change preaction contract", async  () => {
        let instance = await EbbsSocialForum.deployed();
        await instance.setPreActionAddress((await BlockPreAction.deployed()).address);

        let gotEx = false;
        try {
            await instance.createPost(0, stringToBytes("Hello World!"), {from: accounts[1]});
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        try {
            await instance.updatePost(0, stringToBytes("1234"));
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        try {
            await instance.vote(1, 0, {from: accounts[0]});
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        let oldMeta = web3.utils.hexToBytes((await instance.getPost(1)).postMeta);
        try {
            await instance.setMeta(1, oldMeta, stringToBytes("metaMod1"), {from: accounts[1]});
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        try {
            await instance.setAdmin(accounts[1], true);
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        try {
            await instance.setActive(false);
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        gotEx = false;
        try {
            await instance.kill();
        } catch (e) {
            gotEx = true;
        }
        assert.isTrue(gotEx);

        await instance.setPreActionAddress((await AllowPreAction.deployed()).address);
    });

    it("should be possible for admins to kill a contract", async () => {
        let instance = await EbbsSocialForum.deployed();

        await instance.kill();

        let gotEx = false;
        try {
            assert.isTrue((await instance.isActive()));
        } catch (ex) {
            gotEx = true;
        }
        assert.isTrue(gotEx);
    });
});
