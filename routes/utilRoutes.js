import express from "express";
import * as utilController from "../controllers/utilController.js";

const router = express.Router({ mergeParams: true });

router.get("/exportWE", utilController.generateWaterElectricExcel);

router.get("/exportI", utilController.generateInternetExcel);

router.get("/:unitId", utilController.getAllUtils);

router.post("/exportSelected", utilController.generateUtilityPdf);

router.get("/add/:unitId", utilController.showAddForm);

router.post("/:unitId", utilController.addUtilityBill);

router.get("/edit/:id", utilController.showEditUtilityForm);

router.post("/edit/:id", utilController.updateUtilityBill);

router.get("/paymentList/:id", utilController.showPaymentList);

router.get("/createPayment/:id", utilController.showCreatePayment);

router.post("/createPayment/:id", utilController.insertPayment);

export default router;
