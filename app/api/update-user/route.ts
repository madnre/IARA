// app/api/update-user/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import bcrypt from "bcrypt";

// Ensure Firebase Admin is initialized.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "thesis1-d9ca1",
      clientEmail: "firebase-adminsdk-q9diu@thesis1-d9ca1.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCFJgtwLSTKvdg3\nn/9Xg1N5qKm0kTz8NWNqyYH2pgPvO325IxjD47bVr6tyd+IuFKlXUzD0QkUk0BDP\noCzsRVyw+LKduXgH5b9cJEk+eqZCv6sHhpAKHgwIOo7XvMT4mYvScWjgUm7+Wv5J\ndZ8hMHSqjYcMwy5RDZpXnaVb69EO0n6i3uK2hMkJrKL6fkFdaFHw9XM0kuoTKEuX\nfrYCjaYvrMWv5GcSqcHJ4wHYmUDllmw/N14AyVD1MXUnJmtjGw3PVjQZF01GY8LK\nQVpqSB15EsjU+ci5e1iptWEM9PWMMjaASubBsneuhbH1Ra51MmGO25QxiDgYaXIJ\nh9xPZZvVAgMBAAECggEAELjYN2ioBgFlQgkpWa2P4ofc9mVGNjujRoJTvO0ZMea0\nEbgXcGStLfWfz+LACH8GTIYRcB/RjL/H2LeaZLsKWtyFHDtymHVRfOo+u6bOMjRd\nr7aF6QtggfkOvwgBaeJo1c9x9zhLIc0+Qe4Qg+vQvynCpAbwTnQppebR4XNCoHx/\nVA2TfoDIeE079CsYYk4OZtZnJ8qJS2KxedyHV2GbOkrs8/zFEn1JYfJR5LVJPSJR\nlOxOoAiIrphAef/VsJMe0I4BabvCpzVPBm5/ySDwseaQ6lDczj6sdngnrMJxd6f6\n8T9RXzd1lmPI+OiLZAA3xaSQ1m90lP7uR83lFlFieQKBgQC6jvm+u0bW8EQQDzZd\nP4ZSsz8oOOFsUSpCYJkLciktlLifwyGDeWHase988rzbWSrjgWBXeK6fKviXYyus\nkfg/rJLTlVw7WKdVW8FLiYpuY1KrK79UlTUWv96oSd/I0vN3pfsIXYIErbYp31dA\n2Dr5qErRlpNJEYR0letGGxnJ3QKBgQC2ta3+YiMgyjDeVL3K7S9xzdVVc3br/yAb\nENe113TV6sRF7rLCpxpLWK+CiIAD12BOnEyH2sdPCsU7OMzK8ysc9ekhDqlyLW+Y\nmkzTLgJPZOYvCSIYqjBC44NwdVJkxpMGAlNVPf4NmNB8CPn7Ox0IJ59HLmgJgTjB\nzfXHEWxGWQKBgQC1SKIfWVSpIKjDAkVNr6ETU+MXbs5+txBdmAigOrsQ8+fEN5Wl\ncJpKLYYO4MHsVGV81geMeFUXjmYqlc+mzeFx3nx+5jDN6oQQSi02/dxrEFEQzF4M\nD0Gbba8r0T2IpJS5u6yIoHTrnvHZFpJvDK+iUosBx1QwOLmBoP0TDtqscQKBgQCg\nKrYDmS4oMXcTf//8413DCuioBxdKHJWdhG9E1kJywGIc1/pXDzvKr0z0RgrK00R2\nxSeFtLEhxlRN7SYCB5dUxPIAa6T5FYGNqj4MpnmZ9d6ffwcnzhGOoXl43TBEbZs3\nGlTJFhYe/0ZMZWYW6aQyoOFM+g5zvpbttkptnwVmyQKBgQCTZsp3yDwvDNSNKlUi\nvlqEoBwlt3YkPR8Im8dWNcr7hIdCkYPGQrvjF0MTSTQ3IHAKrPptUBZVe0YgJMGA\n4dHKU10qqgIi2mqRL0EqJePBi0dchRBu87EroshvvcEczUL7stoR/6RWbscH+P4J\nOqT/xIQUrQtvoemCVoNE5ILmyA==\n-----END PRIVATE KEY-----\n".replace(/\\n/g, "\n"),
    }),
    databaseURL: "https://thesis1-d9ca1-default-rtdb.asia-southeast1.firebasedatabase.app/",
  });
}

export async function POST(request: Request) {
  try {
    const { editUserId, name, email, password, role, username } = await request.json();

    if (!editUserId || !name || !email || !role || !username) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build the update data. Hash password only if one is provided.
    const updatedData: { [key: string]: any } = { name, email, role };
    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updatedData.password = hashedPassword;
    }

    // Update the user in Firebase Realtime Database under the provided key.
    await admin.database().ref(`logins/${editUserId}`).update(updatedData);

    return NextResponse.json(
      { message: "User updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error updating user", details: error.message },
      { status: 500 }
    );
  }
}
