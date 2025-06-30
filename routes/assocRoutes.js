import express from "express";
import * as assocController from "../controllers/assocController.js";

const router = express.Router({ mergeParams: true });

router.get("/:unitId", assocController.getAllAssocDues);

router.get("/add/:unitId", assocController.showAddForm);

router.post("/:unitId", assocController.addAssocDues);

router.get("/edit/:id", assocController.showEditAssocForm);

router.post("/edit/:id", assocController.updateAssocDues);

router.get("/:assocId/pdf", assocController.generateAssocDuesPdf);

router.get("/payment/:id", assocController.showEditPaymentForm);

router.post("/payment/:id", assocController.updatePayment);

export default router;
