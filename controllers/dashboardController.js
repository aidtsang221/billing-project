import pool from "../db.js";

export const getDashboard = async (req, res) => {
  try {
    const [assocDashboard] = await pool.query(`
        SELECT
            u.unit_no,
            CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
            COALESCE(SUM(ap.amt_paid), 0) AS total_paid,
            ad.total_amt,
            ad.status
        FROM association_dues ad
        LEFT JOIN unit u ON u.unit_id = ad.unit_id
        LEFT JOIN owner o ON o.unit_id = u.unit_id
        LEFT JOIN assoc_payments ap ON ap.assoc_id = ad.assoc_id
        GROUP BY 
            ad.assoc_id,
            o.first_name,
            o.last_name,
            u.unit_no,
            ad.total_amt,
            ad.status
            
        ORDER BY ad.due_date DESC
        LIMIT 5
        `);

    const [utilDashboard] = await pool.query(`
      SELECT
        u.unit_no,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
          COALESCE(SUM(up.amt_paid), 0) AS total_paid,
          ut.total_amt,
          ut.status
      FROM utility ut
      LEFT JOIN unit u ON u.unit_id = ut.unit_id
      LEFT JOIN owner o ON o.unit_id = u.unit_id
      LEFT JOIN util_payments up ON up.util_id = ut.util_id
      GROUP BY 
        ut.util_id,
          o.first_name,
          o.last_name,
          u.unit_no,
          ut.total_amt,
          ut.status
          
      ORDER BY ut.due_date DESC
      LIMIT 5
      `);

    res.render("index", { assocDashboard, utilDashboard });
  } catch (error) {
    console.error("Error fetching association dues:", error);
    res
      .status(500)
      .send("Error fetching association dues. Please check server logs.");
  }
};
