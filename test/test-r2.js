import {
  uploadPublicFile,
  uploadPrivateFile,
  getPrivateFileUrl,
  deletePublicFile,
  deletePrivateFile,
  publicFileExists,
  privateFileExists,
} from "../services/storage/r2.service.js";

const contentType = "text/plain";
const testContent = "ScholaNode R2 storage test successful!";
const testBuffer = Buffer.from(testContent);

const testFileName = "r2-test.txt";

const uploadToR2 = async (uploadUrl) => {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: testBuffer,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
};

const testPublicBucket = async () => {
  let key;

  try {
    console.log("\n--- Testing Public Bucket ---");

    const upload = await uploadPublicFile({
      folder: "test",
      originalName: testFileName,
      contentType,
    });

    key = upload.key;

    await uploadToR2(upload.uploadUrl);
    console.log("1. Upload successful");

    const exists = await publicFileExists(key);
    if (!exists) throw new Error("Public object not found");

    console.log("2. Object exists");

    const download = await fetch(upload.publicUrl);
    if (!download.ok) throw new Error("Public download failed");

    const content = await download.text();
    if (content !== testContent) {
      throw new Error("Downloaded content does not match");
    }

    console.log("3. Public download successful");

    await deletePublicFile(key);
    console.log("4. Object deleted");

    const stillExists = await publicFileExists(key);
    if (stillExists) throw new Error("Object still exists after deletion");

    console.log("5. Deletion verified");
  } catch (error) {
    console.error("Public bucket test failed:", error.message);
    throw error;
  } finally {
    if (key) {
      await deletePublicFile(key).catch(() => {});
    }
  }
};

const testPrivateBucket = async () => {
  let key;

  try {
    console.log("\n--- Testing Private Bucket ---");

    const upload = await uploadPrivateFile({
      folder: "test",
      originalName: testFileName,
      contentType,
    });

    key = upload.key;

    await uploadToR2(upload.uploadUrl);
    console.log("1. Upload successful");

    const exists = await privateFileExists(key);
    if (!exists) throw new Error("Private object not found");

    console.log("2. Object exists");

    const downloadUrl = await getPrivateFileUrl(key);
    const download = await fetch(downloadUrl);

    if (!download.ok) throw new Error("Private download failed");

    const content = await download.text();
    if (content !== testContent) {
      throw new Error("Downloaded content does not match");
    }

    console.log("3. Private signed download successful");

    await deletePrivateFile(key);
    console.log("4. Object deleted");

    const stillExists = await privateFileExists(key);
    if (stillExists) throw new Error("Object still exists after deletion");

    console.log("5. Deletion verified");
  } catch (error) {
    console.error("Private bucket test failed:", error.message);
    throw error;
  } finally {
    if (key) {
      await deletePrivateFile(key).catch(() => {});
    }
  }
};

const runTests = async () => {
  try {
    await testPublicBucket();
    await testPrivateBucket();

    console.log("\nAll R2 tests passed successfully!");
  } catch {
    console.error("\nR2 testing failed. Check the error above.");
    process.exitCode = 1;
  }
};

runTests();