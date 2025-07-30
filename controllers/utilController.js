import pool from "../db.js";
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";

// Get All Utility Bills by unit id
export const getAllUtils = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [utilities] = await pool.query(
      `
      SELECT ut.*, uts.rate, uts.start_date, uts.end_date, uts.due_date, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        WHERE u.unit_id = ?
        ORDER BY ut.util_id ASC`,
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
      SELECT s.category, uts.id AS utilSettingId, uts.rate, uts.start_date, uts.end_date, uts.due_date
      FROM settings s
      JOIN utility_settings uts ON uts.setting_id = s.setting_id
      WHERE s.bldg_id = ? AND s.category IN ('water', 'electricity', 'internet')
    `,
      [unitInfo.bldg_id]
    );

    const rates = {
      water: settings.find((s) => s.category === "water"),
      electricity: settings.find((s) => s.category === "electricity"),
      internet: settings.find((s) => s.category === "internet"),
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
  const { utilSettingId, prev_reading, curr_reading, total_amt } = req.body;

  // Basic validation
  if (!utilSettingId || !total_amt) {
    return res.status(400).send("All fields are required.");
  }

  try {
    await pool.query(
      "INSERT INTO utility (unit_id, utilsetting_id, prev_reading, curr_reading, total_amt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
      [unitId, utilSettingId, prev_reading || 0, curr_reading || 0, total_amt]
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
      `SELECT ut.*, uts.rate, uts.start_date, uts.end_date, uts.due_date, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
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
        DATE_FORMAT(uts.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(uts.end_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(uts.due_date, '%Y-%m-%d') AS due_date,
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
      SELECT s.category, uts.id AS utilSettingId, uts.rate, uts.start_date, uts.end_date, uts.due_date
      FROM settings s
      JOIN utility_settings uts ON uts.setting_id = s.setting_id
      WHERE s.bldg_id = ? AND s.category IN ('water', 'electricity', 'internet')
      `,
      [utilityBill.bldg_id]
    );

    const rates = {
      water: settingsResult.find((s) => s.category === "water"),
      electricity: settingsResult.find((s) => s.category === "electricity"),
      internet: settingsResult.find((s) => s.category === "internet"),
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
  const { utilSettingId, prev_reading, curr_reading, total_amt, unit_id } =
    req.body;

  try {
    const [result] = await pool.query(
      "UPDATE utility SET utilsetting_id = ?, prev_reading = ?, curr_reading = ?, total_amt = ? WHERE util_id = ?",
      [utilSettingId, prev_reading || 0, curr_reading || 0, total_amt, utilId]
    );

    res.redirect(`/utilityBills/${unit_id}`);
  } catch (error) {
    console.error("Error updating utility bills:", error);
    res.status(500).send("Error updating utility bills. Please try again.");
  }
};

//Show Edit Payment Status
export const showEditPaymentForm = async (req, res) => {
  const utilId = req.params.id;

  try {
    const [utilRows] = await pool.query(
      `
      SELECT
		    ut.*,
        u.unit_no,
        u.unit_id,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        uts.start_date,
        uts.end_date,
        uts.due_date,
        b.bldg_name
      FROM
        utility ut
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
      WHERE
        ut.util_id = ?`,
      [utilId]
    );

    if (utilRows.length === 0) {
      return res.status(404).send("Utility Bill record not found.");
    }

    const utilBills = utilRows[0];
    utilBills.remaining_balance = utilBills.total_amt - utilBills.amt_paid;

    res.render("utilityBills/payment", { utilBills });
  } catch (error) {
    console.error("Error creating utility bills:", error);
    res
      .status(500)
      .send("Error creating utility bills. Please check server logs.");
  }
};

//Edit Payment Status
export const updatePayment = async (req, res) => {
  const utilId = req.params.id;
  const { ack_no, payment_amount, date_paid } = req.body;

  // Basic validation
  if (!payment_amount || payment_amount <= 0) {
    return res.status(400).send("Payment amount must be greater than zero.");
  } else if (!ack_no || ack_no.trim() === "") {
    return res.status(400).send("Acknowledgment number is required.");
  } else if (!date_paid) {
    return res.status(400).send("Date paid is required.");
  }

  try {
    const [currentRecord] = await pool.query(
      `SELECT total_amt, amt_paid, unit_id 
       FROM utility
       WHERE util_id = ?`,
      [utilId]
    );

    const record = currentRecord[0];
    const totalAmount = record.total_amt;
    const currentPaid = record.amt_paid || 0;
    const newTotalPaid = currentPaid + parseFloat(payment_amount);

    // Determine new status
    let newStatus;
    if (newTotalPaid >= totalAmount) {
      newStatus = "paid";
    } else {
      newStatus = "unpaid";
    }

    // Update the payment information
    const [result] = await pool.query(
      `UPDATE utility 
       SET amt_paid = ?, status = ?, ack_no = ?, date_paid = ?, updated_at = NOW() 
       WHERE util_id = ?`,
      [newTotalPaid, newStatus, ack_no, date_paid, utilId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Failed to update payment information.");
    }

    res.redirect(`/utilityBills/${record.unit_id}`);
  } catch (error) {
    console.error("Error updating utility bills:", error);
    res.status(500).send("Error updating utility bills. Please try again.");
  }
};

//Delete Utility Bill
export const deleteUtility = async (req, res) => {
  const utilId = req.params.id;

  try {
    const [result] = await pool.query("DELETE FROM utility WHERE util_id = ?", [
      utilId,
    ]);

    console.log("Deleted: ", result);
  } catch (error) {
    console.error("Error deleting utility:", error);
    res.status(500).send("Error deleting utility. Please try again.");
  }
};

//Generate Utility Report As Excel - Water Electric
export const generateWaterElectricExcel = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ut.*, CONCAT('RC', '', ut.util_id) AS bill_no, uts.rate, uts.start_date, uts.end_date, uts.due_date, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        WHERE s.category = 'water' || s.category = 'electricity'
        ORDER BY ut.util_id ASC
    `);

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Water and Electricity Report");

    worksheet.columns = [
      { header: "Bill No.", key: "bill_no", width: 10 },
      { header: "Bldg Name", key: "bldg_name", width: 10 },
      { header: "Owner", key: "owner_name", width: 20 },
      { header: "Unit No.", key: "unit_no", width: 10 },
      { header: "AR No.", key: "ack_no", width: 15 },
      { header: "Rate", key: "rate", width: 15 },
      { header: "Previous Reading", key: "prev_reading", width: 15 },
      { header: "Current Reading", key: "curr_reading", width: 15 },
      { header: "Total Amount", key: "total_amt", width: 15 },
      { header: "Amount Paid", key: "amt_paid", width: 15 },
      { header: "Period Start", key: "start_date", width: 15 },
      { header: "Period End", key: "end_date", width: 15 },
      { header: "Due Date", key: "due_date", width: 15 },
      { header: "Date Paid", key: "date_paid", width: 15 },
      { header: "Status", key: "status", width: 10 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        start_date: new Date(row.start_date).toLocaleDateString(),
        end_date: new Date(row.end_date).toLocaleDateString(),
        due_date: new Date(row.due_date).toLocaleDateString(),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=water_electric_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating Excel:", err);
    res.status(500).send("Something went wrong while generating the report.");
  }
};

//Generate Utility Report As Excel - Internet
export const generateInternetExcel = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ut.*, CONCAT('RC', '', ut.util_id) AS bill_no, uts.rate, uts.start_date, uts.end_date, uts.due_date, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        WHERE s.category = 'internet'
        ORDER BY ut.util_id ASC
    `);

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Water and Electricity Report");

    worksheet.columns = [
      { header: "Bill No.", key: "bill_no", width: 10 },
      { header: "Bldg Name", key: "bldg_name", width: 10 },
      { header: "Owner", key: "owner_name", width: 20 },
      { header: "Unit No.", key: "unit_no", width: 10 },
      { header: "AR No.", key: "ack_no", width: 15 },
      { header: "Total Amount", key: "total_amt", width: 15 },
      { header: "Amount Paid", key: "amt_paid", width: 15 },
      { header: "Period Start", key: "start_date", width: 15 },
      { header: "Period End", key: "end_date", width: 15 },
      { header: "Due Date", key: "due_date", width: 15 },
      { header: "Date Paid", key: "date_paid", width: 15 },
      { header: "Status", key: "status", width: 10 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        start_date: new Date(row.start_date).toLocaleDateString(),
        end_date: new Date(row.end_date).toLocaleDateString(),
        due_date: new Date(row.due_date).toLocaleDateString(),
        date_paid: new Date(row.date_paid).toLocaleDateString(),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=internet_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating Excel:", err);
    res.status(500).send("Something went wrong while generating the report.");
  }
};
