import pool from "../db.js";

async function getUnitDetails(unitId) {
  const [rows] = await pool.query(
    `
        SELECT u.*, b.bldg_name
        FROM unit u
        JOIN bldg b ON u.bldg_id = b.bldg_id
        WHERE u.unit_id = ?
    `,
    [unitId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

// Read All Tenants for a Specific Unit
export const getAllTenantsForUnit = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const unit = await getUnitDetails(unitId);
    if (!unit) {
      return res.status(404).send("Unit not found.");
    }

    const [tenants] = await pool.query(
      "SELECT * FROM tenant WHERE unit_id = ?",
      [unitId]
    );
    res.render("tenants/index", { unit: unit, tenants: tenants });
  } catch (error) {
    console.error("Error fetching tenants for unit:", error);
    res.status(500).send("Error fetching tenants. Please check server logs.");
  }
};

// Display Add Tenant Form for a Specific Unit
export const showAddTenantForm = async (req, res) => {
  const unitId = req.params.unitId;
  try {
    const unit = await getUnitDetails(unitId);
    if (!unit) {
      return res.status(404).send("Unit not found.");
    }
    res.render("tenants/add", { unit: unit });
  } catch (error) {
    console.error("Error loading add tenant form:", error);
    res.status(500).send("Error loading add tenant form. Please try again.");
  }
};

//Create New Tenant for a Specific Unit
export const addTenant = async (req, res) => {
  const unitId = req.params.unitId;
  const { first_name, last_name } = req.body;

  if (
    !first_name ||
    !last_name ||
    first_name.trim() === "" ||
    last_name.trim() === ""
  ) {
    return res.status(400).send("First name and last name are required.");
  }

  try {
    const unit = await getUnitDetails(unitId);
    if (!unit) {
      return res.status(404).send("Unit not found.");
    }

    await pool.query(
      "INSERT INTO tenant (unit_id, first_name, last_name) VALUES (?, ?, ?)",
      [unitId, first_name.trim(), last_name.trim()]
    );
    res.redirect(`/units/${unitId}/tenants`);
  } catch (error) {
    console.error("Error adding tenant:", error);
    res.status(500).send("Error adding tenant. Please try again.");
  }
};

// Display Edit Tenant Form
export const showEditTenantForm = async (req, res) => {};

// Update Existing Tenant
export const updateTenant = async (req, res) => {};
