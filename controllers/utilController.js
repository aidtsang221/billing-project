import pool from "../db.js";
import puppeteer from "puppeteer";

// Get All Utility Bills by unit id
export const getAllUtils = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [utilities] = await pool.query(
      `
      SELECT ut.*, uts.rate, b.bldg_name, u.unit_no, CONCAT(t.first_name, " ", t.last_name) AS tenant_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN tenant t ON t.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        WHERE u.unit_id = ?`,
      [unitId]
    );

    const [unitInfoRows] = await pool.query(
      `SELECT unit_id FROM unit WHERE unit_id = ?`,
      [unitId]
    );

    const unitInfo = unitInfoRows[0];

    res.render("utilityBills/index", { utilities, unitInfo });
  } catch (error) {
    console.error("Error fetching utility bills:", error);
    res
      .status(500)
      .send("Error fetching utility bills. Please check server logs.");
  }
};

// Display Add Form
export const showAddForm = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [unit] = await pool.query(
      `
      SELECT u.unit_id, u.unit_no, u.unit_area, b.bldg_name, b.bldg_id
      FROM unit u
      JOIN bldg b ON u.bldg_id = b.bldg_id
      WHERE u.unit_id = ?`,
      [unitId]
    );

    const unitInfo = unit[0];

    const [settings] = await pool.query(
      `
      SELECT s.category, uts.id AS utilSettingId, uts.rate
      FROM settings s
      JOIN utility_settings uts ON uts.setting_id = s.setting_id
      WHERE s.bldg_id = ? AND s.category IN ('water', 'electricity')
    `,
      [unitInfo.bldg_id]
    );

    const rates = {
      water: settings.find((s) => s.category === "water"),
      electricity: settings.find((s) => s.category === "electricity"),
    };

    res.render("utilityBills/add", { unitInfo, rates });
  } catch (error) {
    console.error("Error creating utility bills:", error);
    res
      .status(500)
      .send("Error creating utility bills. Please check server logs.");
  }
};

// Create New Utility Bill of unit id
export const addUtilityBill = async (req, res) => {
  const unitId = req.params.unitId;
  const {
    utilSettingId,
    prev_reading,
    curr_reading,
    total_amt,
    start_date,
    end_date,
    due_date,
  } = req.body;

  console.log("Body Request: ", req.body);

  // Basic validation
  if (
    !utilSettingId ||
    !prev_reading ||
    !curr_reading ||
    !total_amt ||
    !start_date ||
    !end_date ||
    !due_date
  ) {
    return res.status(400).send("All fields are required.");
  }

  try {
    await pool.query(
      "INSERT INTO utility (unit_id, utilsetting_id, prev_reading, curr_reading, total_amt, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        unitId,
        utilSettingId,
        prev_reading,
        curr_reading,
        total_amt,
        start_date,
        end_date,
        due_date,
      ]
    );
    res.redirect(`/utilityBills/${unitId}`);
  } catch (error) {
    console.error("Error adding utility bill:", error);
  }
};

export const generateUtilityPdf = async (req, res) => {
  const utilId = req.params.utilId;
  let browser;

  try {
    const [utilRows] = await pool.query(
      `SELECT ut.*, uts.rate, b.bldg_name, u.unit_no, CONCAT(t.first_name, " ", t.last_name) AS tenant_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN tenant t ON t.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        WHERE ut.util_id = ?`,
      [utilId]
    );

    const utilBill = utilRows[0];

    const htmlContent = await new Promise((resolve, reject) => {
      req.app.render(
        "utilityBills/utilityBillPdf",
        {
          util: utilBill,
        },
        (err, html) => {
          if (err) {
            return reject(err);
          }
          resolve(html);
        }
      );
    });

    // Launch Puppeteer browser
    // browser = await puppeteer.launch({
    //   args: ["--no-sandbox", "--disable-setuid-sandbox"], // Recommended for production environments
    // });
    browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set the HTML content of the page
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0", // Wait until network activity is low
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
    });

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=Utility_Bill_Unit_${utilBill.unit_no}_${utilBill.last_name}_${utilId}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating PDF. Please try again.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

//Show Edit Utility
export const showEditUtilityForm = async (req, res) => {
  const utilId = req.params.id;

  try {
    const [util] = await pool.query(
      `
      SELECT
        ut.util_id,
        ut.unit_id,
        ut.prev_reading,
        ut.curr_reading,
        ut.utilsetting_id,
        ut.total_amt,
        DATE_FORMAT(ut.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(ut.end_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(ut.due_date, '%Y-%m-%d') AS due_date,
        u.unit_no,
        b.bldg_id,
        b.bldg_name,
        s.category,
        uts.rate
      FROM utility ut
      JOIN unit u ON ut.unit_id = u.unit_id
      JOIN bldg b ON u.bldg_id = b.bldg_id
      JOIN utility_settings uts ON ut.utilsetting_id = uts.id
      JOIN settings s ON uts.setting_id = s.setting_id
      WHERE ut.util_id = ?`,
      [utilId]
    );

    const utilityBill = util[0];

    const [settingsResult] = await pool.query(
      `
      SELECT s.category, uts.id AS utilSettingId, uts.rate
      FROM settings s
      JOIN utility_settings uts ON uts.setting_id = s.setting_id
      WHERE s.bldg_id = ? AND s.category IN ('water', 'electricity')
      `,
      [utilityBill.bldg_id]
    );

    const rates = {
      water: settingsResult.find((s) => s.category === "water"),
      electricity: settingsResult.find((s) => s.category === "electricity"),
    };

    res.render("utilityBills/edit", { utilityBill, rates });
  } catch (error) {
    console.error("Error editing utility bill:", error);
    res
      .status(500)
      .send("Error editing utility bill. Please check server logs.");
  }
};

//Edit Utility
export const updateUtilityBill = async (req, res) => {
  const utilId = req.params.id;
  const {
    utilSettingId,
    prev_reading,
    curr_reading,
    total_amt,
    start_date,
    end_date,
    due_date,
    unit_id,
  } = req.body;

  // Basic validation
  if (!prev_reading || !curr_reading || !start_date || !end_date || !due_date) {
    return res.status(400).send("All fields are required");
  }

  try {
    const [result] = await pool.query(
      "UPDATE utility SET utilsetting_id = ?, prev_reading = ?, curr_reading = ?, total_amt = ?, start_date = ?, end_date = ?, due_date = ? WHERE util_id = ?",
      [
        utilSettingId,
        prev_reading,
        curr_reading,
        total_amt,
        start_date,
        end_date,
        due_date,
        utilId,
      ]
    );

    res.redirect(`/utilityBills/${unit_id}`);
  } catch (error) {
    console.error("Error updating utility bills:", error);
    res.status(500).send("Error updating utility bills. Please try again.");
  }
};
