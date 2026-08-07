import fs from "fs";
import path from "path";

const filePath = path.resolve(process.cwd(), "schema_mysql.sql");
try {
  const buf = fs.readFileSync(filePath);
  // Check UTF-16LE BOM or zero bytes
  let text = "";
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.toString("utf16le");
  } else if (buf.includes(0)) {
    text = buf.toString("utf16le");
  } else {
    text = buf.toString("utf8");
  }

  // Clean up any leading BOM character
  text = text.replace(/^\uFEFF/, "");

  fs.writeFileSync(filePath, text, { encoding: "utf8" });
  console.log("Successfully converted schema_mysql.sql to UTF-8. Lines count:", text.split("\n").length);
} catch (err) {
  console.error("Error converting schema_mysql.sql:", err.message);
}
