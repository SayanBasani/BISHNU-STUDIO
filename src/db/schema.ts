/**
 * Bishnu Studio - Unified Database Schema
 * Seamlessly provides Neon PostgreSQL schema for production traffic and
 * SQLite schema compatibility for local embedded development & offline testing.
 *
 * Implements BS-DB-01:
 * Dynamic table proxying enables runtime switching between Neon PostgreSQL and
 * SQLite/LibSQL without rebuilding query references or restarting services.
 */

import * as pg from "./schema.pg";
import * as sq from "./schema.sqlite";
import { getDatabaseProviderManager } from "../lib/db-provider";

function createTableProxy<T extends object, U extends object>(pgTable: T, sqTable: U): U {
  return new Proxy(sqTable as any, {
    get(target, prop, receiver) {
      const isPg = getDatabaseProviderManager().isCurrentProviderPostgres();
      const active = isPg ? pgTable : sqTable;
      return Reflect.get(active, prop, receiver);
    },
    has(target, prop) {
      const isPg = getDatabaseProviderManager().isCurrentProviderPostgres();
      const active = isPg ? pgTable : sqTable;
      return Reflect.has(active, prop);
    },
    ownKeys() {
      const isPg = getDatabaseProviderManager().isCurrentProviderPostgres();
      const active = isPg ? pgTable : sqTable;
      return Reflect.ownKeys(active);
    },
    getOwnPropertyDescriptor(target, prop) {
      const isPg = getDatabaseProviderManager().isCurrentProviderPostgres();
      const active = isPg ? pgTable : sqTable;
      return Reflect.getOwnPropertyDescriptor(active, prop);
    },
  }) as U;
}

// 1-28 Unified Schema Table Proxies
export const users = createTableProxy(pg.users, sq.users) as typeof sq.users;
export const userAddresses = createTableProxy(pg.userAddresses, sq.userAddresses) as typeof sq.userAddresses;
export const sessions = createTableProxy(pg.sessions, sq.sessions) as typeof sq.sessions;
export const verificationTokens = createTableProxy(pg.verificationTokens, sq.verificationTokens) as typeof sq.verificationTokens;
export const productCategories = createTableProxy(pg.productCategories, sq.productCategories) as typeof sq.productCategories;
export const products = createTableProxy(pg.products, sq.products) as typeof sq.products;
export const productImages = createTableProxy(pg.productImages, sq.productImages) as typeof sq.productImages;
export const services = createTableProxy(pg.services, sq.services) as typeof sq.services;
export const serviceOptions = createTableProxy(pg.serviceOptions, sq.serviceOptions) as typeof sq.serviceOptions;
export const servicePrices = createTableProxy(pg.servicePrices, sq.servicePrices) as typeof sq.servicePrices;
export const orders = createTableProxy(pg.orders, sq.orders) as typeof sq.orders;
export const orderItems = createTableProxy(pg.orderItems, sq.orderItems) as typeof sq.orderItems;
export const orderFiles = createTableProxy(pg.orderFiles, sq.orderFiles) as typeof sq.orderFiles;
export const payments = createTableProxy(pg.payments, sq.payments) as typeof sq.payments;
export const auditLogs = createTableProxy(pg.auditLogs, sq.auditLogs) as typeof sq.auditLogs;
export const authenticationEvents = createTableProxy(pg.authenticationEvents, sq.authenticationEvents) as typeof sq.authenticationEvents;
export const shopSettings = createTableProxy(pg.shopSettings, sq.shopSettings) as typeof sq.shopSettings;
export const paymentSubmissions = createTableProxy(pg.paymentSubmissions, sq.paymentSubmissions) as typeof sq.paymentSubmissions;
export const orderStatusHistory = createTableProxy(pg.orderStatusHistory, sq.orderStatusHistory) as typeof sq.orderStatusHistory;
export const accountAppeals = createTableProxy(pg.accountAppeals, sq.accountAppeals) as typeof sq.accountAppeals;
export const productReviews = createTableProxy(pg.productReviews, sq.productReviews) as typeof sq.productReviews;
export const shopUpiAccounts = createTableProxy(pg.shopUpiAccounts, sq.shopUpiAccounts) as typeof sq.shopUpiAccounts;
export const developerProfile = createTableProxy(pg.developerProfile, sq.developerProfile) as typeof sq.developerProfile;
export const orderReturns = createTableProxy(pg.orderReturns, sq.orderReturns) as typeof sq.orderReturns;
export const orderReturnItems = createTableProxy(pg.orderReturnItems, sq.orderReturnItems) as typeof sq.orderReturnItems;
export const notifications = createTableProxy(pg.notifications, sq.notifications) as typeof sq.notifications;
export const dbSyncOutbox = createTableProxy(pg.dbSyncOutbox, sq.dbSyncOutbox) as typeof sq.dbSyncOutbox;
export const dbSyncHistory = createTableProxy(pg.dbSyncHistory, sq.dbSyncHistory) as typeof sq.dbSyncHistory;

// Re-export dialects for low-level migration or synchronization scripts
export { pg, sq };
