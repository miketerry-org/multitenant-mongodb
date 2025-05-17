// createDB.js:

"use strict";

// load all necessary modules
const mongoose = require("mongoose");
const { serverLog } = require("multitenant-express");

function createDB(tenant) {
  // define the timeout as 10 seconds
  const timeoutMs = 10000;

  const connection = mongoose.createConnection(tenant.db_url, {});

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      connection.removeAllListeners();
      reject(
        new Error(
          `Tenant ${tenant.tenant_id}: Connection timed out after ${timeoutMs}milliseconds`
        )
      );
    }, timeoutMs); // always wait up to 10 seconds

    connection.once("connected", () => {
      clearTimeout(timer);
      serverLog.info(
        `Tenant ${tenant.tenant_id}: Connected to "${connection.name}"`
      );
      resolve(connection);
    });

    connection.once("error", err => {
      clearTimeout(timer);
      serverLog.error(`Tenant ${tenant_id}: ${err.message}`);
      reject(new Error(`Tenant ${tenant.tenant_id}: ${err.message}`));
    });

    connection.on("disconnected", () => {
      serverLog.info(
        `Tenant ${tenant.tenant_id}: Disconnected from "${connection.name}"`
      );
    });
  });
}

module.exports = createDB;
