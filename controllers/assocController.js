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

// Get All AssocDues Bills by unit id
export const getAllAssocDues = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [assocDues] = await pool.query(
      `
      SELECT
        ad.*,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        b.bldg_id,
        b.bldg_name,
        u.unit_no,
        u.unit_area
      FROM association_dues ad
      JOIN unit u ON ad.unit_id = u.unit_id
      JOIN owner o ON o.unit_id = u.unit_id
      JOIN bldg b ON b.bldg_id = u.bldg_id
      WHERE u.unit_id = ?
      `,
      [unitId]
    );

    const [unitInfoRows] = await pool.query(
      `SELECT unit_id FROM unit WHERE unit_id = ?`,
      [unitId]
    );

    const unitInfo = unitInfoRows[0];

    res.render("assocBills/index", { assocDues, unitInfo });
  } catch (error) {
    console.error("Error fetching association dues:", error);
    res
      .status(500)
      .send("Error fetching association dues. Please check server logs.");
  }
};

// Display Add Form by unit id
export const showAddForm = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [units] = await pool.query(
      `
      SELECT u.unit_id, u.unit_no, u.unit_area, b.bldg_name, ads.id AS assocSettingId, ads.amount, ads.start_date, ads.end_date, ads.due_date
        FROM unit u
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN settings s ON s.bldg_id = b.bldg_id AND s.category = "association_dues"
        JOIN assocdues_settings ads ON ads.setting_id = s.setting_id
        WHERE u.unit_id = ?`,
      [unitId]
    );

    const unit = units[0];

    res.render("assocBills/add", { unit });
  } catch (error) {
    console.error("Error creating association dues:", error);
    res
      .status(500)
      .send("Error creating association dues. Please check server logs.");
  }
};

// Create New Association Dues by unit id
export const addAssocDues = async (req, res) => {
  const unitId = req.params.unitId;
  const { assocSettingId, adjustment, total_amt } = req.body;

  // Basic validation
  if (!unitId || !total_amt) {
    return res
      .status(400)
      .send("All fields (Unit and Total_Amount) are required.");
  }

  try {
    // 1. Fetch snapshot values from assocdues_settings
    const [settings] = await pool.query(
      `SELECT amount, start_date, end_date, due_date
         FROM assocdues_settings
        WHERE id = ?`,
      [assocSettingId]
    );

    if (settings.length === 0) {
      return res.status(404).send("Association dues setting not found.");
    }

    const { amount, start_date, end_date, due_date } = settings[0];

    await pool.query(
      "INSERT INTO association_dues (unit_id, assocsetting_id, total_amt, adjustment, amount, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        unitId,
        assocSettingId,
        parseFloat(total_amt),
        parseFloat(adjustment),
        amount,
        start_date,
        end_date,
        due_date,
      ]
    );
    res.redirect(`/assocBills/${unitId}`);
  } catch (error) {
    console.error("Error adding association dues:", error);
  }
};

//Generate AssocDues PDF
export const generateAssocDuesPdf = async (req, res) => {
  const assocId = req.params.assocId;
  let browser;

  try {
    const [assocRows] = await pool.query(
      `SELECT a.*, a.total_amt, o.first_name, o.last_name, b.bldg_name, u.unit_no, u.unit_area
        FROM association_dues a
        JOIN unit u ON a.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
        WHERE a.assoc_id = ?`,
      [assocId]
    );
    if (assocRows.length === 0) {
      return res
        .status(404)
        .send("Association Dues record not found for this owner.");
    }
    const assocBill = assocRows[0];

    const htmlContent = await new Promise((resolve, reject) => {
      // Use req.app.render to get the HTML string without sending the response
      req.app.render(
        "assocBills/assocBillPdf",
        {
          assoc: assocBill,
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
      format: "Letter",
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
      `inline; filename=Assoc_Bill_Unit_${assocBill.unit_no}_${assocBill.last_name}_${assocId}.pdf`
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

//Generate Association Dues Report As Excel
export const generateAssocDuesExcel = async (req, res) => {
  try {
    const bldgId = req.params.bldgId;

    const [rows] = await pool.query(
      `
      SELECT a.*, ap.*, CONCAT('M', '', a.assoc_id) AS bill_no, (a.total_amt + a.adjustment) as final_amount, CONCAT(o.first_name, ' ', o.last_name) AS owner_name, b.bldg_name, u.unit_no
        FROM association_dues a
        JOIN unit u ON a.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
        LEFT JOIN assoc_payments ap ON ap.assoc_id = a.assoc_id
        WHERE b.bldg_id = ?
    `,
      [bldgId]
    );

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Association Dues Report");

    const buildingName = rows.length > 0 ? rows[0].bldg_name : "Building Name";

    worksheet.mergeCells("A1:L1");
    const headerRow = worksheet.getCell("A1");
    headerRow.value = buildingName;
    headerRow.font = { size: 16, bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    const columns = [
      { header: "Bill No.", key: "bill_no", width: 10 },
      { header: "Owner", key: "owner_name", width: 20 },
      { header: "Unit No.", key: "unit_no", width: 10 },
      { header: "AR No.", key: "ack_no", width: 15 },
      { header: "Total Amt", key: "final_amount", width: 15 },
      { header: "Adjustment Fee", key: "adjustment", width: 15 },
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
        final_amount: row.final_amount ? Number(row.final_amount) : 0,
        adjustment: row.adjustment ? Number(row.adjustment) : 0,
        amt_paid: row.amt_paid ? Number(row.amt_paid) : 0,
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
      "attachment; filename=assoc_dues_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error generating Excel:", err);
    res.status(500).send("Something went wrong while generating the report.");
  }
};

//Show Edit Association Dues
export const showEditAssocForm = async (req, res) => {
  const assocId = req.params.id;

  try {
    const [assocDuesRows] = await pool.query(
      `
      SELECT
        u.unit_id,
        u.unit_no,
        u.unit_area,
        ad.assoc_id,
        ad.total_amt,
        ad.adjustment,
        DATE_FORMAT(ad.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(ad.end_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(ad.due_date, '%Y-%m-%d') AS due_date,
        ad.amount
      FROM
        association_dues ad
        JOIN unit u ON ad.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN settings s ON s.bldg_id = b.bldg_id
        AND s.category = "association_dues"
      WHERE
        ad.assoc_id = ?`,
      [assocId]
    );

    const assocDues = assocDuesRows[0];

    res.render("assocBills/edit", { assocDues });
  } catch (error) {
    console.error("Error creating association dues:", error);
    res
      .status(500)
      .send("Error creating association dues. Please check server logs.");
  }
};

//Edit Association Dues
export const updateAssocDues = async (req, res) => {
  const assocId = req.params.id;
  const { unit_id, adjustment } = req.body;

  try {
    const [result] = await pool.query(
      "UPDATE association_dues SET adjustment = ? WHERE assoc_id = ?",
      [adjustment, assocId]
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .send("Association Dues not found or no changes made.");
    }
    res.redirect(`/assocBills/${unit_id}`);
  } catch (error) {
    console.error("Error updating association dues:", error);
    res.status(500).send("Error updating association dues. Please try again.");
  }
};

//Show Payment List
export const showPaymentList = async (req, res) => {
  const assocId = req.params.id;

  try {
    const [unit] = await pool.query(
      `
      SELECT
        ad.assoc_id,
        u.unit_no,
        u.unit_id
      FROM association_dues ad
        JOIN unit u ON u.unit_id = ad.unit_id
      WHERE
        ad.assoc_id = ?
      `,
      [assocId]
    );

    const [assocDues] = await pool.query(
      `
      SELECT
        ap.assoc_id,
		    ap.ack_no,
		    ap.amt_paid,
		    ap.date_paid,
        u.unit_no,
        u.unit_id
      FROM
        assoc_payments ap
        JOIN association_dues ad ON ad.assoc_id = ap.assoc_id
        JOIN unit u ON u.unit_id = ad.unit_id
      WHERE
        ap.assoc_id = ?`,
      [assocId]
    );

    res.render("assocBills/paymentList", { assocDues, unit });
  } catch (error) {
    console.error("Error showing association dues payment list:", error);
    res
      .status(500)
      .send(
        "Error showing association dues payment list. Please check server logs."
      );
  }
};

//Show Create Payment
export const showCreatePayment = async (req, res) => {
  const assocId = req.params.id;

  try {
    const [assocDuesRows] = await pool.query(
      `
      SELECT
		    ad.*,
        u.unit_no,
        u.unit_id,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        b.bldg_name,
        (ad.total_amt + COALESCE(ad.adjustment, 0)) as final_amount,
        ad.start_date,
        ad.end_date,
        ad.due_date
      FROM
        association_dues ad
        JOIN unit u ON ad.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
      WHERE
        ad.assoc_id = ?`,
      [assocId]
    );

    const [assocPayRows] = await pool.query(
      `
      SELECT SUM(amt_paid) as total_paid FROM assoc_payments WHERE assoc_id = ?
      `,
      [assocId]
    );

    const totalAmt = parseFloat(assocDuesRows[0].total_amt) || 0;
    const adjustment = parseFloat(assocDuesRows[0].adjustment) || 0;
    const totalPaid = assocPayRows[0].total_paid || 0;
    const finalAmount = totalAmt + adjustment;
    const remainingBalance = finalAmount - totalPaid;

    if (assocDuesRows.length === 0) {
      return res.status(404).send("Association dues record not found.");
    }

    const assocDues = {
      ...assocDuesRows[0],
      amt_paid: totalPaid,
      remaining_balance: remainingBalance,
      final_amount: finalAmount,
    };

    res.render("assocBills/createPayment", { assocDues });
  } catch (error) {
    console.error("Error showing association dues payment:", error);
    res
      .status(500)
      .send(
        "Error showing association dues payment. Please check server logs."
      );
  }
};

//Create Payment and update payment status
export const insertPayment = async (req, res) => {
  const assocId = req.params.id;
  const { ack_no, payment_amount, date_paid } = req.body;

  // Basic validation
  if (!payment_amount || payment_amount <= 0) {
    return res.status(400).send("Payment amount must be greater than zero.");
  } else if (!ack_no || ack_no.trim() === "") {
    return res.status(400).send("Acknowledgment number is required.");
  } else if (!date_paid) {
    return res.status(400).send("Date Paid is required.");
  }

  try {
    const [[assocDues]] = await pool.query(
      `SELECT total_amt, adjustment, unit_id, status FROM association_dues WHERE assoc_id = ?`,
      [assocId]
    );

    if (!assocDues) {
      return res.status(404).send("Association dues record not found.");
    }

    const totalAmt = parseFloat(assocDues.total_amt) || 0;
    const adjustment = parseFloat(assocDues.adjustment) || 0;

    const totalDue = totalAmt + adjustment;

    // Sum up existing payments
    const [[{ totalPaid }]] = await pool.query(
      `SELECT SUM(amt_paid) as totalPaid FROM assoc_payments WHERE assoc_id = ?`,
      [assocId]
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
      `INSERT INTO assoc_payments (assoc_id, ack_no, amt_paid, date_paid) VALUES (?, ?, ?, ?)`,
      [assocId, ack_no, payment_amount, date_paid]
    );

    // Determine new status
    let newStatus;
    if (newTotalPaid >= totalDue) {
      newStatus = "paid";
    } else if (newTotalPaid > 0 && newTotalPaid < totalDue) {
      newStatus = "partial";
    } else {
      newStatus = "unpaid";
    }

    // Update the payment information
    const [result] = await pool.query(
      `UPDATE association_dues 
       SET status = ?, updated_at = NOW() 
       WHERE assoc_id = ?`,
      [newStatus, assocId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Failed to update payment information.");
    }

    res.redirect(`/assocBills/${assocDues.unit_id}`);
  } catch (error) {
    console.error("Error updating association dues:", error);
    res.status(500).send("Error updating association dues. Please try again.");
  }
};

//Update Association Dues to Cancel
export const cancelAssocDues = async (req, res) => {
  const assocId = req.params.id;

  try {
    const [[assocDues]] = await pool.query(
      `SELECT unit_id FROM association_dues WHERE assoc_id = ?`,
      [assocId]
    );

    const [result] = await pool.query(
      `UPDATE association_dues
       SET status = 'cancelled', updated_at = NOW()
       WHERE assoc_id = ?
       `,
      [assocId]
    );

    res.redirect(`/assocBills/${assocDues.unit_id}`);
  } catch (error) {
    console.error("Error cancelling association dues:", error);
    res
      .status(500)
      .send("Error cancelling association dues. Please try again.");
  }
};

export const sendOTP = async (req, res) => {
  // Generate random number 1–100
  generatedOTP = Math.floor(Math.random() * 100) + 1;

  //email of the person - to be changed
  const emailToSend = "xekoj49255@feralrex.com";

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
