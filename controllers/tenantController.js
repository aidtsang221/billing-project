import pool from "../db.js";

// Read All Tenants
export const getAllTenants = async (req, res) => {
  try {
    const [tenants] = await pool.query(
      `SELECT t.tenant_id, t.first_name, t.last_name, 
        u.unit_no, b.bldg_name FROM tenant t
        JOIN unit u ON t.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id`
    );
    res.render("tenants/index", { tenants: tenants });
  } catch (error) {
    console.error("Error fetching tenants for unit:", error);
    res.status(500).send("Error fetching tenants. Please check server logs.");
  }
};

// Display Add Tenant Form
export const showAddTenantForm = async (req, res) => {
  try {
    const [buildingsAndUnits] = await pool.query(`
      SELECT 
        b.bldg_id, 
        b.bldg_name, 
        u.unit_id, 
        u.unit_no 
      FROM bldg b
      JOIN unit u ON b.bldg_id = u.bldg_id
    `);
    //creates an array of building objects, where each building
    // contains its bldg_id, bldg_name, and an array of its units.
    const buildingsMap = new Map();
    buildingsAndUnits.forEach((row) => {
      if (!buildingsMap.has(row.bldg_id)) {
        buildingsMap.set(row.bldg_id, {
          bldg_id: row.bldg_id,
          bldg_name: row.bldg_name,
          units: [],
        });
      }
      buildingsMap.get(row.bldg_id).units.push({
        unit_id: row.unit_id,
        unit_no: row.unit_no,
      });
    });
    const buildings = Array.from(buildingsMap.values());

    res.render("tenants/add", { buildings: buildings });
  } catch (error) {
    console.error("Error loading add tenant form:", error);
    res.status(500).send("Error loading add tenant form. Please try again.");
  }
};

//Create New Tenant
export const addTenant = async (req, res) => {
  const { first_name, last_name, unit_id } = req.body;

  if (
    !first_name ||
    !last_name ||
    !unit_id ||
    first_name.trim() === "" ||
    last_name.trim() === ""
  ) {
    return res.status(400).send("First name, last name, unit id are required.");
  }

  try {
    await pool.query(
      "INSERT INTO tenant (unit_id, first_name, last_name) VALUES (?, ?, ?)",
      [unit_id, first_name.trim(), last_name.trim()]
    );
    res.redirect(`/tenants`);
  } catch (error) {
    console.error("Error adding tenant:", error);
    res.status(500).send("Error adding tenant. Please try again.");
  }
};

// Display Edit Tenant Form
export const showEditTenantForm = async (req, res) => {
  const tenantId = req.params.id;

  try {
    const [[tenant]] = await pool.query(
      `SELECT t.*, u.unit_no, u.bldg_id, b.bldg_name 
       FROM tenant t
       JOIN unit u ON t.unit_id = u.unit_id
       JOIN bldg b ON u.bldg_id = b.bldg_id
       WHERE t.tenant_id = ?`,
      [tenantId]
    );
    if (tenant.length === 0) {
      return res.status(404).send("Tenant not found.");
    }

    const [buildingsAndUnits] = await pool.query(`
      SELECT
        b.bldg_id,
        b.bldg_name,
        u.unit_id,
        u.unit_no
      FROM bldg b
      JOIN unit u ON b.bldg_id = u.bldg_id
      ORDER BY b.bldg_name, u.unit_no
    `);

    const buildingsMap = new Map();
    buildingsAndUnits.forEach((row) => {
      if (!buildingsMap.has(row.bldg_id)) {
        buildingsMap.set(row.bldg_id, {
          bldg_id: row.bldg_id,
          bldg_name: row.bldg_name,
          units: [],
        });
      }
      buildingsMap.get(row.bldg_id).units.push({
        unit_id: row.unit_id,
        unit_no: row.unit_no,
      });
    });
    const buildings = Array.from(buildingsMap.values());

    res.render("tenants/edit", {
      tenant,
      buildings,
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).send("Error loading tenant. Please try again.");
  }
};

// Update Existing Tenant
export const updateTenant = async (req, res) => {
  const tenantId = req.params.id;
  const { unit_id, first_name, last_name } = req.body;

  // Basic validation
  if (
    !first_name ||
    !last_name ||
    !unit_id ||
    first_name.trim() === "" ||
    last_name.trim() === ""
  ) {
    return res.status(400).send("First Name and Last Name are required.");
  }

  try {
    const [result] = await pool.query(
      "UPDATE tenant SET unit_id = ?, first_name = ?, last_name = ? WHERE tenant_id = ?",
      [unit_id, first_name.trim(), last_name.trim(), tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).send("Tenant not found or no changes made.");
    }
    res.redirect("/tenants");
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).send("Error updating tenant. Please try again.");
  }
};
