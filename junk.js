// createDB.js

"use strict";

// load all necessary modules
const mongoose = require("mongoose");
const { serverLog } = require("multitenant-express");

async function createDB(tenant) {
  const timeoutMs = 10000;

  const connection = mongoose.createConnection(tenant.db_url, {});

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        connection.removeAllListeners();
        reject(
          new Error(
            `Tenant ${tenant.tenant_id}: Connection timed out after ${timeoutMs} milliseconds`
          )
        );
      }, timeoutMs);

      connection.once("connected", () => {
        clearTimeout(timer);
        resolve();
      });

      connection.once("error", err => {
        clearTimeout(timer);
        reject(new Error(`Tenant ${tenant.tenant_id}: ${err.message}`));
      });
    });

    serverLog.info(
      `Tenant ${tenant.tenant_id}: Connected to "${connection.name}"`
    );

    connection.on("disconnected", () => {
      serverLog.info(
        `Tenant ${tenant.tenant_id}: Disconnected from "${connection.name}"`
      );
    });

    return connection;
  } catch (err) {
    serverLog.error(`Tenant ${tenant.tenant_id}: ${err.message}`);
    throw err;
  }
}

module.exports = createDB;
