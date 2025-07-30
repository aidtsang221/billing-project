import pool from "../db.js";
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";

// Get All AssocDues Bills by unit id
export const getAllAssocDues = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const [assocDues] = await pool.query(
      `
      SELECT
        ad.*,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        b.bldg_name,
        u.unit_no,
        ads.amount,
        ads.start_date,
        ads.end_date,
        ads.due_date,
        u.unit_area
      FROM association_dues ad
      JOIN unit u ON ad.unit_id = u.unit_id
      JOIN owner o ON o.unit_id = u.unit_id
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
    await pool.query(
      "INSERT INTO association_dues (unit_id, assocsetting_id, total_amt, adjustment, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
      [unitId, assocSettingId, total_amt, adjustment]
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
      `SELECT a.*, (a.total_amt + a.adjustment) as final_amount, ads.amount, ads.start_date, ads.end_date, ads.due_date, o.first_name, o.last_name, b.bldg_name, u.unit_no
        FROM association_dues a
        JOIN assocdues_settings ads ON ads.id = a.assocsetting_id
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

//Generate Association Dues Report As Excel
export const generateAssocDuesExcel = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, CONCAT('M', '', a.assoc_id) AS bill_no, (a.total_amt + a.adjustment) as final_amount, ads.amount, ads.start_date, ads.end_date, ads.due_date, CONCAT(o.first_name, ' ', o.last_name) AS owner_name, b.bldg_name, u.unit_no
        FROM association_dues a
        JOIN assocdues_settings ads ON ads.id = a.assocsetting_id
        JOIN unit u ON a.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
        JOIN bldg b ON b.bldg_id = u.bldg_id;
    `);

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
      { header: "Total Amt", key: "final_amount", width: 15 }, //with adjustment
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
        DATE_FORMAT(ads.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(ads.end_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(ads.due_date, '%Y-%m-%d') AS due_date,
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
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        b.bldg_name,
        (ad.total_amt + COALESCE(ad.adjustment, 0)) as final_amount,
        ads.start_date,
        ads.end_date,
        ads.due_date
      FROM
        association_dues ad
        JOIN unit u ON ad.unit_id = u.unit_id
        JOIN owner o ON o.unit_id = u.unit_id
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
    console.error("Error showing association dues payment:", error);
    res
      .status(500)
      .send(
        "Error showing association dues payment. Please check server logs."
      );
  }
};

//Edit Payment Status
export const updatePayment = async (req, res) => {
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

    // Update the payment information
    const [result] = await pool.query(
      `UPDATE association_dues 
       SET amt_paid = ?, status = ?, ack_no = ?, date_paid = ?, updated_at = NOW() 
       WHERE assoc_id = ?`,
      [newTotalPaid, newStatus, ack_no, date_paid, assocId]
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

//Delete Association Dues
export const deleteAssocDues = async (req, res) => {
  const assocId = req.params.id;

  try {
    const [result] = await pool.query(
      "DELETE FROM association_dues WHERE assoc_id = ?",
      [assocId]
    );

    console.log("Deleted: ", result);
  } catch (error) {
    console.error("Error deleting association dues:", error);
    res.status(500).send("Error deleting association dues. Please try again.");
  }
};
