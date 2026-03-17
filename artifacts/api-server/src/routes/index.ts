import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import rolesRouter from "./roles";
import dashboardRouter from "./dashboard";
import penjualanRouter from "./penjualan";
import pencairanRouter from "./pencairan";
import biayaRouter from "./biaya";
import masterBarangRouter from "./master-barang";
import masterBankRouter from "./master-bank";
import masterOnlineShopRouter from "./master-online-shop";
import customerRouter from "./customer";
import modalRouter from "./modal";
import laporanRouter from "./laporan";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/roles", rolesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/penjualan", penjualanRouter);
router.use("/pencairan", pencairanRouter);
router.use("/biaya", biayaRouter);
router.use("/master-barang", masterBarangRouter);
router.use("/master-bank", masterBankRouter);
router.use("/master-online-shop", masterOnlineShopRouter);
router.use("/customer", customerRouter);
router.use("/modal", modalRouter);
router.use("/laporan", laporanRouter);

export default router;
