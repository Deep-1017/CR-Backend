import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/product.model";
import Order from "../models/order.model";
import User from "../models/user.model";
import connectDB from "../config/db";

dotenv.config();

connectDB();

const mockProducts: any[] = [];

const importData = async () => {
  try {
    await Product.deleteMany();
    await Order.deleteMany();
    await User.deleteMany();

    try {
      await Product.collection.dropIndex("id_1");
      console.log("ℹ️  Dropped stale id_1 index");
    } catch (_) {
      // Index doesn't exist — nothing to do
    }

    await User.create({
      name: "Admin",
      email: "admin@crmusic.com",
      password: "admin123",
      role: "admin",
    });

    console.log("✅ Admin user created!");

    await Product.insertMany(mockProducts);

    console.log("✅ Musical Instrument Data Imported!");
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Product.deleteMany();
    await Order.deleteMany();
    await User.deleteMany();

    console.log("🗑️  Data Destroyed!");
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

if (process.argv[2] === "-d") {
  destroyData();
} else {
  importData();
}
