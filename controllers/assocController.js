import pool from "../db.js";
import puppeteer from "puppeteer";

// Get All AssocDues Bills by unit id
export const getAllAssocDues = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [assocDues] = await pool.query(
      `
      SELECT
        ad.*,
        (ad.total_amt + COALESCE(ad.adjustment, 0)) as final_amount,
        CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
        b.bldg_name,
        u.unit_no,
        ads.amount,
        u.unit_area
      FROM association_dues ad
      JOIN unit u ON ad.unit_id = u.unit_id
      JOIN tenant t ON t.unit_id = u.unit_id
      JOIN bldg b ON b.bldg_id = u.bldg_id
      JOIN assocdues_settings ads ON ad.assocsetting_id = ads.id
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
      SELECT u.unit_id, u.unit_no, u.unit_area, b.bldg_name, ads.id AS assocSettingId, ads.amount
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
  const {
    assocSettingId,
    adjustment,
    total_amt,
    start_date,
    end_date,
    due_date,
  } = req.body;

  // Basic validation
  if (!unitId || !total_amt || !start_date || !end_date || !due_date) {
    return res
      .status(400)
      .send(
        "All fields (Unit, Total_Amount, Start Date, End Date, Due Date) are required."
      );
  }

  try {
    await pool.query(
      "INSERT INTO association_dues (unit_id, assocsetting_id, total_amt, adjustment, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        unitId,
        assocSettingId,
        total_amt,
        adjustment,
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
      `SELECT a.*, (a.total_amt + a.adjustment) as final_amount, ads.amount, t.first_name, t.last_name, b.bldg_name, u.unit_no
        FROM association_dues a
        JOIN assocdues_settings ads ON ads.id = a.assocsetting_id
        JOIN unit u ON a.unit_id = u.unit_id
        JOIN tenant t ON t.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
        WHERE a.assoc_id = ?`,
      [assocId]
    );
    if (assocRows.length === 0) {
      return res
        .status(404)
        .send("Association Dues record not found for this tenant.");
    }
    const assocBill = assocRows[0];

    assocBill.remaining_balance = assocBill.final_amount - assocBill.amt_paid;

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
        ads.amount
      FROM
        association_dues ad
        JOIN unit u ON ad.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id
        JOIN settings s ON s.bldg_id = b.bldg_id
        AND s.category = "association_dues"
        JOIN assocdues_settings ads ON ads.setting_id = s.setting_id
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
  const { unit_id, adjustment, start_date, end_date, due_date } = req.body;

  // Basic validation
  if (!start_date || !end_date || !due_date) {
    return res
      .status(400)
      .send("All fields (Start Date, End Date, Due Date) are required.");
  }

  try {
    const [result] = await pool.query(
      "UPDATE association_dues SET adjustment = ?, start_date = ?, end_date = ?, due_date = ? WHERE assoc_id = ?",
      [adjustment, start_date, end_date, due_date, assocId]
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

//Show Edit Payment Status
export const showEditPaymentForm = async (req, res) => {
  const assocId = req.params.id;

  try {
    const [assocDuesRows] = await pool.query(
      `
      SELECT
		    ad.*,
        u.unit_no,
        u.unit_id,
        CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
        b.bldg_name,
        (ad.total_amt + COALESCE(ad.adjustment, 0)) as final_amount
      FROM
        association_dues ad
        JOIN unit u ON ad.unit_id = u.unit_id
        JOIN tenant t ON t.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id
        JOIN assocdues_settings ads ON ad.assocsetting_id = ads.id
      WHERE
        ad.assoc_id = ?`,
      [assocId]
    );

    if (assocDuesRows.length === 0) {
      return res.status(404).send("Association dues record not found.");
    }

    const assocDues = assocDuesRows[0];

    // Calculate remaining balance
    assocDues.remaining_balance = assocDues.final_amount - assocDues.amt_paid;

    res.render("assocBills/payment", { assocDues });
  } catch (error) {
    console.error("Error creating association dues:", error);
    res
      .status(500)
      .send("Error creating association dues. Please check server logs.");
  }
};

//Edit Payment Status
export const updatePayment = async (req, res) => {
  const assocId = req.params.id;
  const { ack_no, payment_amount } = req.body;

  // Basic validation
  if (!payment_amount || payment_amount <= 0) {
    return res.status(400).send("Payment amount must be greater than zero.");
  }

  if (!ack_no || ack_no.trim() === "") {
    return res.status(400).send("Acknowledgment number is required.");
  }

  try {
    const [currentRecord] = await pool.query(
      `SELECT total_amt, adjustment, amt_paid, unit_id 
       FROM association_dues 
       WHERE assoc_id = ?`,
      [assocId]
    );

    if (currentRecord.length === 0) {
      return res.status(404).send("Association dues record not found.");
    }

    const record = currentRecord[0];
    const totalAmount = record.total_amt + (record.adjustment || 0);
    const currentPaid = record.amt_paid || 0;
    const newTotalPaid = currentPaid + parseFloat(payment_amount);

    // Determine new status
    let newStatus;
    if (newTotalPaid >= totalAmount) {
      newStatus = "paid";
    } else if (newTotalPaid > 0) {
      newStatus = "partial";
    } else {
      newStatus = "unpaid";
    }

    // Prevent overpayment
    if (newTotalPaid > totalAmount) {
      return res
        .status(400)
        .send(
          `Payment amount exceeds remaining balance. Maximum payment allowed: ${(
            totalAmount - currentPaid
          ).toFixed(2)}`
        );
    }

    // Update the payment information
    const [result] = await pool.query(
      `UPDATE association_dues 
       SET amt_paid = ?, status = ?, ack_no = ?, updated_at = NOW() 
       WHERE assoc_id = ?`,
      [newTotalPaid, newStatus, ack_no, assocId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Failed to update payment information.");
    }

    res.redirect(`/assocBills/${record.unit_id}`);
  } catch (error) {
    console.error("Error updating association dues:", error);
    res.status(500).send("Error updating association dues. Please try again.");
  }
};
