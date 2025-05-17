// createLog.js:

"use strict";

// Load the server logger
const { serverLog } = require("multitenant-express");
const winston = require("winston");
require("winston-mongodb");
const { MongoClient } = require("mongodb");

async function createLog(tenant) {
  // Destructure values
  const {
    db_url,
    log_collection_name,
    log_expiration_days = undefined,
    log_capped = false,
    log_max_size = undefined,
    log_max_docs = undefined,
  } = tenant;

  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(db_url);
    const db = client.db();

    // Check if collection exists
    const collections = await db
      .listCollections({ name: log_collection_name })
      .toArray();

    if (collections.length === 0) {
      if (log_capped && log_max_docs && log_max_size) {
        await db.createCollection(log_collection_name, {
          capped: true,
          size: log_max_size * 1024 * 1024,
          max: log_max_docs,
        });
        console.debug(
          `express-tenants: Created capped collection: ${log_collection_name} for winston logger`
        );
      } else {
        await db.createCollection(log_collection_name);
        console.debug(
          `express-tenants: Created collection: ${log_collection_name} for winston logger`
        );
      }
    } else {
      console.debug(
        `multitenant-mongodb: Collection already exists: ${log_collection_name}`
      );
    }

    // get connection to the collection
    const collection = db.collection(log_collection_name);

    // Enforce TTL indexing if enabled
    if (log_capped && log_expiration_days) {
      console.debug(
        `multiTenant ${tenant.tenant_id}: Cannot use both capped and TTL options on the same collection.`
      );
      throw new Error(
        `Tenant ${tenant.tenant_id}: Cannot use both capped and TTL options on the same collection.`
      );
    }

    if (!log_capped && log_expiration_days) {
      const indexes = await collection.indexes();
      const ttlExists = indexes.some(
        i =>
          i.key?.timestamp === 1 &&
          i.expireAfterSeconds &&
          i.name === "timestamp_ttl"
      );

      if (!ttlExists) {
        await collection.createIndex(
          { timestamp: 1 },
          {
            expireAfterSeconds: log_expiration_days * 86400,
            name: "timestamp_ttl",
          }
        );
        console.debug(
          `Created TTL index 'timestamp_ttl' for ${log_expiration_days} days`
        );
      } else {
        console.debug("TTL index 'timestamp_ttl' already exists");
      }
    }

    // Create and return the logger
    const logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
        new winston.transports.MongoDB({
          db: db_url,
          collection: log_collection_name,
          level: "info",
          options: {},
        }),
      ],
    });

    // return the winston logger for this tenant
    return logger;
  } catch (err) {
    console.debug(`Tenant ${tenant.tenant_id}: ${err.message}`);
    serverLog.error(`Tenant ${tenant.tenant_id}: ${err.message}`);
    throw new Error(`Tenant ${tenant.tenant_id}: ${err.message}`);
  }
}

module.exports = createLog;
