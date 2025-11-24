import express from "express";
import * as assocController from "../controllers/assocController.js";

const router = express.Router({ mergeParams: true });

router.get("/export/:bldgId", assocController.generateAssocDuesExcel);

router.get("/:unitId", assocController.getAllAssocDues);

router.get("/add/:unitId", assocController.showAddForm);

router.post("/add/:unitId/send-otp", assocController.sendOTP);

router.post("/add/:unitId/verify-otp", assocController.verifyOTP);

router.post("/:unitId", assocController.addAssocDues);

router.get("/edit/:id", assocController.showEditAssocForm);

router.post("/edit/:id", assocController.updateAssocDues);

router.get("/:assocId/pdf", assocController.generateAssocDuesPdf);

router.get("/paymentList/:id", assocController.showPaymentList);

router.get("/createPayment/:id", assocController.showCreatePayment);

router.post("/createPayment/:id", assocController.insertPayment);

router.post("/:id/cancel", assocController.cancelAssocDues); //Cancel

export default router;
