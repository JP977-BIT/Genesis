import { NextRequest, NextResponse } from "next/server";
import * as ftp from "basic-ftp";
import { Writable } from "stream";

export async function POST(request: NextRequest) {
  // Step 1 - Read what the form sent us
  const body = await request.json();
  const { diskNumber, email, pin } = body;

  // Step 2 - FTP connection
  const client = new ftp.Client();

  try {
    // Step 3 - Connect to FTP server
    await client.access({
      host: process.env.FTP_HOST ?? "",
      port: Number(process.env.FTP_PORT ?? 21),
      user: process.env.FTP_USER ?? "",
      password: process.env.FTP_PASSWORD ?? "",
      secure: false,
    });

    // Step 4 - Navigate to client folder
    await client.cd(diskNumber);

    // Step 5 - Download the config file into memory
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    // Step 6 - Build filename dynamically from email
    const filename = `${email}_webconfig.json`;
    await client.downloadTo(writable, filename);
    const configText = Buffer.concat(chunks).toString("utf-8");
    const config = JSON.parse(configText);

    // Step 7 - Verify the ApiPassword against what the user typed
    const validPin = config.API.ApiPassword === pin;
    if (!validPin) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Step 8 - All good, return success
    return NextResponse.json({ success: true });
  } catch (error) {
    // Something went wrong - connection failed or file not found
    console.error("FTP Error:", error);
    return NextResponse.json(
      { message: "Invalid credentials" },
      { status: 401 },
    );
  } finally {
    // Always close the FTP connection
    client.close();
  }
}
