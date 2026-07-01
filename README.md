# Modi-Act Inventory & Billing Engine

This repository contains the source code for my very first real-world commercial project. I architected and built this system from the ground up for an active vehicle accessory business to automate their daily stock operations and secure their billing process.

At its core, this is a commercial-grade inventory management and dynamic pricing engine paired with a high-performance frontend. It was specifically engineered to solve real retail bottlenecks: preventing revenue leaks, managing employee access levels, and tracking physical stock in real time without manual data entry.

## System Highlights

* **Responsive Client Interface:** Features a high-performance, interactive user interface built with React and Next.js. Component rendering and routing are optimized to ensure smooth, low-latency interactions for retail staff during fast-paced checkouts.
* **Dynamic Pricing & RBAC:** Features a robust pricing engine with strict Role-Based Access Control. This enforces minimum selling prices and completely prevents unauthorized price overrides at the checkout counter.
* **Tamper-Proof Audit Logging:** Every single price adjustment is permanently recorded. The system tracks the employee ID, exact timestamp, and the pricing variance to ensure 100% financial accountability for the business owners.
* **Automated Stock Alerts:** Integrates real-time inventory tracking with automated low-stock notifications. This optimizes the reordering process and minimizes unexpected stockouts.
* **Standalone Retail Packaging:** To ensure maximum reliability in an offline retail environment, the entire application architecture was packaged into a standalone Windows executable using PyInstaller and Inno Setup.

## Tech Stack

* **Frontend:** React, Next.js, JavaScript
* **Backend Framework:** Python, Django
* **Database:** PostgreSQL
* **Executable Packaging:** PyInstaller, Inno Setup
