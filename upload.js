import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

const bucketName = 'your-gcs-bucket';
const tempDirectory = process.cwd();
const folderId = '';
const serviceAccountPath = 'path/to/service_account.json';

// const storage = new Storage({ keyFilename: serviceAccountPath });

const authenticateDrive = async () => {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const authClient = await auth.getClient();
    return google.drive({ version: 'v3', auth: authClient });
};

const listFiles = async (drive, folderId) => {
    const res = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name, owners, modifiedTime)',
    });
    return res.data.files;
};

const uploadCSVToGCS = async (bucketName, localFilePath, destinationFileName) => {
    await storage.bucket(bucketName).upload(localFilePath, {
        destination: destinationFileName,
    });
    console.log(`${localFilePath} uploaded to ${bucketName}/${destinationFileName}`);
};

const createCSV = async (filePath, data) => {
    const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
            { id: 'filename', title: 'Filename' },
            { id: 'owner', title: 'Owner' },
            { id: 'modifiedTime', title: 'Modified Time' },
			{ id: 'created', title: 'Created Time' }
        ]
    });
    await csvWriter.writeRecords(data);
    console.log('CSV file created successfully');
};

const logDirectoryContent = (directory) => {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Unable to scan directory: ${err}`);
        } else {
            console.log(`Directory content: ${files.join(', ')}`);
        }
    });
};

const uploadLightroomExportsToGCS = async (bucketName) => {
    const drive = await authenticateDrive();
    const files = await listFiles(drive, folderId);
    const csvFilePath = path.join(tempDirectory, 'lightroom_exports.csv');
    const fileData = [];

    logDirectoryContent(tempDirectory);

    for (const file of files) {
        if (file.name === "PASS") {
            const passFiles = await listFiles(drive, file.id);
            for (const passFile of passFiles) {
                fileData.push({
                    filename: passFile.name,
                    owner: passFile.owners[0].emailAddress,
                    modifiedTime: passFile.modifiedTime,
					created: passFile.created
                });
            }
        }
    }

    await createCSV(csvFilePath, fileData);
    logDirectoryContent(tempDirectory);
    await uploadCSVToGCS(bucketName, csvFilePath, 'lightroom_exports.csv');

    // fs.unlinkSync(csvFilePath); // Comment out this line to keep the CSV file
};

uploadLightroomExportsToGCS(bucketName)
    .then(() => console.log('All files processed and CSV uploaded successfully'))
    .catch(err => console.error(`Error in upload process: ${err}`));