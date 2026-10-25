/**
 * Bishnu Studio - Unified Database Schema
 * Seamlessly provides Neon PostgreSQL schema for production traffic and
 * SQLite schema compatibility for local embedded development & offline testing.
 */

const dbUrl = process.env.DATABASE_URL || "";
const isPg = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

import * as pg from "./schema.pg";
import * as sq from "./schema.sqlite";

export const users = (isPg ? pg.users : sq.users) as typeof sq.users;
export const userAddresses = (isPg ? pg.userAddresses : sq.userAddresses) as typeof sq.userAddresses;
export const sessions = (isPg ? pg.sessions : sq.sessions) as typeof sq.sessions;
export const verificationTokens = (isPg ? pg.verificationTokens : sq.verificationTokens) as typeof sq.verificationTokens;
export const productCategories = (isPg ? pg.productCategories : sq.productCategories) as typeof sq.productCategories;
export const products = (isPg ? pg.products : sq.products) as typeof sq.products;
export const productImages = (isPg ? pg.productImages : sq.productImages) as typeof sq.productImages;
export const services = (isPg ? pg.services : sq.services) as typeof sq.services;
export const serviceOptions = (isPg ? pg.serviceOptions : sq.serviceOptions) as typeof sq.serviceOptions;
export const servicePrices = (isPg ? pg.servicePrices : sq.servicePrices) as typeof sq.servicePrices;
export const orders = (isPg ? pg.orders : sq.orders) as typeof sq.orders;
export const orderItems = (isPg ? pg.orderItems : sq.orderItems) as typeof sq.orderItems;
export const orderFiles = (isPg ? pg.orderFiles : sq.orderFiles) as typeof sq.orderFiles;
export const payments = (isPg ? pg.payments : sq.payments) as typeof sq.payments;
export const auditLogs = (isPg ? pg.auditLogs : sq.auditLogs) as typeof sq.auditLogs;
export const authenticationEvents = (isPg ? pg.authenticationEvents : sq.authenticationEvents) as typeof sq.authenticationEvents;
export const shopSettings = (isPg ? pg.shopSettings : sq.shopSettings) as typeof sq.shopSettings;
export const paymentSubmissions = (isPg ? pg.paymentSubmissions : sq.paymentSubmissions) as typeof sq.paymentSubmissions;
export const orderStatusHistory = (isPg ? pg.orderStatusHistory : sq.orderStatusHistory) as typeof sq.orderStatusHistory;
export const accountAppeals = (isPg ? pg.accountAppeals : sq.accountAppeals) as typeof sq.accountAppeals;
export const productReviews = (isPg ? pg.productReviews : sq.productReviews) as typeof sq.productReviews;
export const shopUpiAccounts = (isPg ? pg.shopUpiAccounts : sq.shopUpiAccounts) as typeof sq.shopUpiAccounts;
export const developerProfile = (isPg ? pg.developerProfile : sq.developerProfile) as typeof sq.developerProfile;
export const orderReturns = (isPg ? pg.orderReturns : sq.orderReturns) as typeof sq.orderReturns;
export const orderReturnItems = (isPg ? pg.orderReturnItems : sq.orderReturnItems) as typeof sq.orderReturnItems;

