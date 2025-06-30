import express from "express";
import * as bldgController from "../controllers/bldgController.js";

const router = express.Router();

router.get("/", bldgController.getAllBldgs);

router.get("/add", bldgController.showAddForm);

router.post("/", bldgController.addBldg);

router.get("/edit/:id", bldgController.showEditForm);

router.post("/edit/:id", bldgController.updateBldg);

export default router;
