import pool from "../db.js";
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

// Variable to temporarily store OTP
let generatedOTP = null;

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "aidantwo86@gmail.com",
    pass: "nejr ewpj fmuq lngx",
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Get All Utility Bills of water and electric by unit id
export const getAllUtils = async (req, res) => {
  const unitId = req.params.unitId;
  const { category } = req.query;

  try {
    let sql = `
    SELECT ut.*, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        WHERE u.unit_id = ?`;

    const params = [unitId];

    if (category === "we") {
      sql += " AND s.category IN ('water','electricity')";
    } else if (category) {
      sql += " AND s.category = ?";
      params.push(category);
    }

    sql += " ORDER BY ut.util_id ASC";

    const [utilities] = await pool.query(sql, params);

    const [unitInfoRows] = await pool.query(
      `SELECT unit_id FROM unit WHERE unit_id = ?`,
      [unitId]
    );

    const unitInfo = unitInfoRows[0];

    res.render("utilityBills/index", { utilities, unitInfo, req });
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
  const { adjustment, utilSettingId, prev_reading, curr_reading, total_amt } =
    req.body;

  // Basic validation
  if (!utilSettingId || !total_amt) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const [settings] = await pool.query(
      `SELECT rate, start_date, end_date, due_date
         FROM utility_settings
        WHERE id = ?`,
      [utilSettingId]
    );

    if (settings.length === 0) {
      return res.status(404).send("Utility setting not found.");
    }

    const { rate, start_date, end_date, due_date } = settings[0];

    await pool.query(
      "INSERT INTO utility (unit_id, utilsetting_id, prev_reading, curr_reading, adjustment, total_amt, rate, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        unitId,
        utilSettingId,
        prev_reading || 0,
        curr_reading || 0,
        adjustment,
        total_amt,
        rate,
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
  const billIds = JSON.parse(req.body.billIds);

  if (!billIds || billIds.length === 0) {
    return res.status(400).send("No bills selected");
  }

  let browser;

  try {
    const [utilRows] = await pool.query(
      `SELECT ut.*, s.category, u.unit_no, b.bldg_name, 
              CONCAT(o.first_name, " ", o.last_name) AS owner_name
       FROM utility ut
       JOIN unit u ON ut.unit_id = u.unit_id
       JOIN bldg b ON u.bldg_id = b.bldg_id
       JOIN owner o ON o.unit_id = u.unit_id
       JOIN utility_settings uts ON ut.utilsetting_id = uts.id
       JOIN settings s ON uts.setting_id = s.setting_id
       WHERE ut.util_id IN (?)`,
      [billIds]
    );

    const htmlContent = await new Promise((resolve, reject) => {
      req.app.render(
        "utilityBills/utilityBillPdf",
        {
          util: utilRows,
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
      format: "Legal",
      printBackground: true,
    });

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=Utility_Bill_Selected.pdf`
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
        ut.adjustment,
        DATE_FORMAT(ut.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(ut.end_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(ut.due_date, '%Y-%m-%d') AS due_date,
        u.unit_no,
        b.bldg_id,
        b.bldg_name,
        s.category,
        ut.rate
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
  const {
    utilSettingId,
    prev_reading,
    curr_reading,
    total_amt,
    unit_id,
    adjustment,
  } = req.body;

  try {
    const [result] = await pool.query(
      "UPDATE utility SET utilsetting_id = ?, prev_reading = ?, curr_reading = ?, total_amt = ?, adjustment = ? WHERE util_id = ?",
      [
        utilSettingId,
        prev_reading || 0,
        curr_reading || 0,
        total_amt,
        adjustment,
        utilId,
      ]
    );

    res.redirect(`/utilityBills/${unit_id}`);
  } catch (error) {
    console.error("Error updating utility bills:", error);
    res.status(500).send("Error updating utility bills. Please try again.");
  }
};

//Show Payment List
export const showPaymentList = async (req, res) => {
  const utilId = req.params.id;

  try {
    const [unit] = await pool.query(
      `
      SELECT
        ut.util_id,
        u.unit_no,
        u.unit_id
      FROM utility ut
        JOIN unit u ON u.unit_id = ut.unit_id
      WHERE
        ut.util_id = ?`,
      [utilId]
    );

    const [util] = await pool.query(
      `
      SELECT
        up.util_id,
		    up.ack_no,
		    up.amt_paid,
		    up.date_paid,
        u.unit_no,
        u.unit_id
      FROM
        util_payments up
        JOIN utility ut ON ut.util_id = up.util_id
        JOIN unit u ON ut.unit_id = u.unit_id
      WHERE
        up.util_id = ?`,
      [utilId]
    );

    res.render("utilityBills/paymentList", { util, unit });
  } catch (error) {
    console.error("Error showing utility payment list:", error);
    res
      .status(500)
      .send("Error showing utility payment list. Please check server logs.");
  }
};

//Show Create Payment
export const showCreatePayment = async (req, res) => {
  const utilId = req.params.id;

  try {
    const [utilRows] = await pool.query(
      `
      SELECT
		    ut.*,
        u.unit_no,
        u.unit_id,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        b.bldg_name
      FROM
        utility ut
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
      WHERE
        ut.util_id = ?`,
      [utilId]
    );

    const [utilPayRows] = await pool.query(
      `
      SELECT SUM(amt_paid) as total_paid FROM util_payments WHERE util_id = ?
      `,
      [utilId]
    );

    const totalPaid = utilPayRows[0].total_paid || 0;
    const remainingBalance = utilRows[0].total_amt - totalPaid;

    if (utilRows.length === 0) {
      return res.status(404).send("Utility record not found.");
    }

    const utils = {
      ...utilRows[0],
      amt_paid: totalPaid,
      remaining_balance: remainingBalance,
    };

    res.render("utilityBills/createPayment", { utils });
  } catch (error) {
    console.error("Error showing utility payment:", error);
    res
      .status(500)
      .send("Error showing utility payment. Please check server logs.");
  }
};

//Create Payment and update payment status
export const insertPayment = async (req, res) => {
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
    const [[util]] = await pool.query(
      `SELECT total_amt, unit_id, status FROM utility WHERE util_id = ?`,
      [utilId]
    );

    if (!util) {
      return res.status(404).send("Utility record not found.");
    }

    const totalDue = parseFloat(util.total_amt);

    // Sum up existing payments
    const [[{ totalPaid }]] = await pool.query(
      `SELECT SUM(amt_paid) as totalPaid FROM util_payments WHERE util_id = ?`,
      [utilId]
    );

    const newTotalPaid =
      parseFloat(totalPaid) || 0 + parseFloat(payment_amount) || 0;

    // Prevent overpayment
    if (newTotalPaid > totalDue) {
      return res
        .status(400)
        .send(
          `Payment exceeds total amount due. You still owe ${
            totalDue - totalPaid
          }`
        );
    }

    const [payment] = await pool.query(
      `INSERT INTO util_payments (util_id, ack_no, amt_paid, date_paid) VALUES (?, ?, ?, ?)`,
      [utilId, ack_no, payment_amount, date_paid]
    );

    // Determine new status
    let newStatus;
    if (newTotalPaid >= totalDue) {
      newStatus = "paid";
    } else {
      newStatus = "unpaid";
    }

    // Update the payment information
    const [result] = await pool.query(
      `UPDATE utility 
       SET status = ?, updated_at = NOW() 
       WHERE util_id = ?`,
      [newStatus, utilId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Failed to update payment information.");
    }

    res.redirect(`/utilityBills/${util.unit_id}`);
  } catch (error) {
    console.error("Error updating utility:", error);
    res.status(500).send("Error updating utility. Please try again.");
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
      SELECT ut.*, up.*, CONCAT('RC', '', ut.util_id) AS bill_no, uts.rate, uts.start_date, uts.end_date, uts.due_date, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        LEFT JOIN util_payments up ON up.util_id = ut.util_id
        WHERE s.category = 'water' || s.category = 'electricity'
        ORDER BY ut.util_id ASC
    `);

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Water and Electricity Report");

    const buildingName = rows.length > 0 ? rows[0].bldg_name : "Building Name";

    worksheet.mergeCells("A1:N1");
    const headerRow = worksheet.getCell("A1");
    headerRow.value = buildingName;
    headerRow.font = { size: 16, bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    const columns = [
      { header: "Bill No.", key: "bill_no", width: 10 },
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

    worksheet.columns = columns.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    worksheet.addRow(columns.map((col) => col.header));

    worksheet.getRow(2).font = { bold: true };
    worksheet.getRow(2).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        rate: row.rate ? Number(row.rate) : 0,
        amt_paid: row.amt_paid ? Number(row.amt_paid) : 0,
        total_amt: row.total_amt ? Number(row.total_amt) : 0,
        start_date: row.start_date
          ? new Date(row.start_date).toLocaleDateString()
          : "",
        end_date: row.end_date
          ? new Date(row.end_date).toLocaleDateString()
          : "",
        due_date: row.due_date
          ? new Date(row.due_date).toLocaleDateString()
          : "",
        date_paid: row.date_paid
          ? new Date(row.date_paid).toLocaleDateString()
          : "",
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
      SELECT ut.*, up.*, CONCAT('RC', '', ut.util_id) AS bill_no, uts.rate, uts.start_date, uts.end_date, uts.due_date, b.bldg_name, u.unit_no, CONCAT(o.first_name, " ", o.last_name) AS owner_name, s.category
        FROM utility ut 
        JOIN unit u ON ut.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN utility_settings uts ON ut.utilsetting_id = uts.id
        JOIN settings s ON uts.setting_id = s.setting_id
        LEFT JOIN util_payments up ON up.util_id = ut.util_id
        WHERE s.category = 'internet'
        ORDER BY ut.util_id ASC
    `);

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Internet Report");

    const buildingName = rows.length > 0 ? rows[0].bldg_name : "Building Name";

    worksheet.mergeCells("A1:K1");
    const headerRow = worksheet.getCell("A1");
    headerRow.value = buildingName;
    headerRow.font = { size: 16, bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    const columns = [
      { header: "Bill No.", key: "bill_no", width: 10 },
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

    worksheet.columns = columns.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    worksheet.addRow(columns.map((col) => col.header));

    worksheet.getRow(2).font = { bold: true };
    worksheet.getRow(2).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        rate: row.rate ? Number(row.rate) : 0,
        amt_paid: row.amt_paid ? Number(row.amt_paid) : 0,
        total_amt: row.total_amt ? Number(row.total_amt) : 0,
        start_date: row.start_date
          ? new Date(row.start_date).toLocaleDateString()
          : "",
        end_date: row.end_date
          ? new Date(row.end_date).toLocaleDateString()
          : "",
        due_date: row.due_date
          ? new Date(row.due_date).toLocaleDateString()
          : "",
        date_paid: row.date_paid
          ? new Date(row.date_paid).toLocaleDateString()
          : "",
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

//Cancel Utilities
export const cancelUtilities = async (req, res) => {
  const utilId = req.params.id;

  try {
    const [[utils]] = await pool.query(
      `SELECT unit_id FROM utility WHERE util_id = ?`,
      [utilId]
    );

    const [result] = await pool.query(
      `
      UPDATE utility
      SET status = 'cancelled', updated_at = NOW()
      WHERE util_id = ?
      `,
      [utilId]
    );

    console.log("Cancelled: ", result);
    res.redirect(`/utilityBills/${utils.unit_id}`);
  } catch (error) {
    console.error("Error cancelling utilities:", error);
    res.status(500).send("Error cancelling utilities. Please try again.");
  }
};

export const sendOTP = async (req, res) => {
  // Generate random number 1–100
  generatedOTP = Math.floor(Math.random() * 100) + 1;

  //email of the person - to be changed
  const emailToSend = "xikim89054@cexch.com";

  try {
    await transporter.sendMail({
      from: "aidantwo86@gmail.com",
      to: emailToSend,
      subject: "Your OTP Code",
      text: `Your OTP is: ${generatedOTP}`,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.json({ success: false });
  }
};

export const verifyOTP = async (req, res) => {
  const userOTP = parseInt(req.body.otp);

  if (userOTP === generatedOTP) {
    return res.json({ valid: true });
  } else {
    return res.json({ valid: false });
  }
};
