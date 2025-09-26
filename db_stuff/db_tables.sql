-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: billing_db
-- ------------------------------------------------------
-- Server version	8.0.40

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assoc_payments`
--

DROP TABLE IF EXISTS assoc_payments;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE assoc_payments (
  payment_id int NOT NULL AUTO_INCREMENT,
  assoc_id int DEFAULT NULL,
  ack_no bigint DEFAULT NULL,
  amt_paid decimal(10,2) DEFAULT NULL,
  date_paid timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  UNIQUE KEY ack_no (ack_no),
  KEY assoc_payments_ibfk_1 (assoc_id),
  CONSTRAINT assoc_payments_ibfk_1 FOREIGN KEY (assoc_id) REFERENCES association_dues (assoc_id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assocdues_settings`
--

DROP TABLE IF EXISTS assocdues_settings;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE assocdues_settings (
  id int NOT NULL AUTO_INCREMENT,
  setting_id int DEFAULT NULL,
  amount decimal(10,2) DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  due_date date DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY setting_id (setting_id),
  CONSTRAINT assocdues_settings_ibfk_1 FOREIGN KEY (setting_id) REFERENCES settings (setting_id)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `association_dues`
--

DROP TABLE IF EXISTS association_dues;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE association_dues (
  assoc_id int NOT NULL AUTO_INCREMENT,
  unit_id int DEFAULT NULL,
  assocsetting_id int DEFAULT NULL,
  amount float DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  due_date date DEFAULT NULL,
  total_amt decimal(10,2) NOT NULL,
  adjustment decimal(10,2) DEFAULT '0.00',
  `status` enum('unpaid','paid','partial') DEFAULT 'unpaid',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (assoc_id),
  KEY assocsetting_id (assocsetting_id),
  KEY unit_id (unit_id),
  CONSTRAINT association_dues_ibfk_2 FOREIGN KEY (assocsetting_id) REFERENCES assocdues_settings (id),
  CONSTRAINT association_dues_ibfk_3 FOREIGN KEY (unit_id) REFERENCES unit (unit_id)
) ENGINE=InnoDB AUTO_INCREMENT=100003 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bldg`
--

DROP TABLE IF EXISTS bldg;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE bldg (
  bldg_id int NOT NULL AUTO_INCREMENT,
  bldg_name text NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bldg_id)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owner`
--

DROP TABLE IF EXISTS owner;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner` (
  owner_id int NOT NULL AUTO_INCREMENT,
  unit_id int NOT NULL,
  first_name varchar(100) DEFAULT NULL,
  last_name varchar(100) DEFAULT NULL,
  is_current tinyint DEFAULT '0',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_id),
  KEY fk_tenant_unit (unit_id),
  CONSTRAINT fk_tenant_unit FOREIGN KEY (unit_id) REFERENCES unit (unit_id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS settings;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE settings (
  setting_id int NOT NULL AUTO_INCREMENT,
  bldg_id int DEFAULT NULL,
  category enum('association_dues','water','electricity','internet') NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_id),
  KEY bldg_id (bldg_id),
  CONSTRAINT bldg_id FOREIGN KEY (bldg_id) REFERENCES bldg (bldg_id)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unit`
--

DROP TABLE IF EXISTS unit;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE unit (
  unit_id int NOT NULL AUTO_INCREMENT,
  bldg_id int DEFAULT NULL,
  unit_no int DEFAULT NULL,
  unit_area float DEFAULT NULL,
  `status` enum('occupied','vacant') DEFAULT 'vacant',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (unit_id),
  KEY unit_ibfk_1 (bldg_id),
  CONSTRAINT unit_ibfk_1 FOREIGN KEY (bldg_id) REFERENCES bldg (bldg_id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `util_payments`
--

DROP TABLE IF EXISTS util_payments;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE util_payments (
  payment_id int NOT NULL AUTO_INCREMENT,
  util_id int DEFAULT NULL,
  ack_no bigint DEFAULT NULL,
  amt_paid float DEFAULT NULL,
  date_paid timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  UNIQUE KEY ack_no (ack_no),
  KEY util_id (util_id),
  CONSTRAINT util_payments_ibfk_1 FOREIGN KEY (util_id) REFERENCES utility (util_id)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `utility`
--

DROP TABLE IF EXISTS utility;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE utility (
  util_id int NOT NULL AUTO_INCREMENT,
  unit_id int DEFAULT NULL,
  utilsetting_id int DEFAULT NULL,
  prev_reading float DEFAULT '0',
  curr_reading float DEFAULT '0',
  rate decimal(10,2) DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  due_date date DEFAULT NULL,
  total_amt decimal(10,2) NOT NULL,
  `status` enum('unpaid','paid') DEFAULT 'unpaid',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (util_id),
  KEY utilsetting_id (utilsetting_id),
  KEY unit_id (unit_id),
  CONSTRAINT utility_ibfk_2 FOREIGN KEY (utilsetting_id) REFERENCES utility_settings (id),
  CONSTRAINT utility_ibfk_3 FOREIGN KEY (unit_id) REFERENCES unit (unit_id)
) ENGINE=InnoDB AUTO_INCREMENT=100003 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `utility_settings`
--

DROP TABLE IF EXISTS utility_settings;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE utility_settings (
  id int NOT NULL AUTO_INCREMENT,
  setting_id int DEFAULT NULL,
  rate decimal(10,2) DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  due_date date DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY setting_id_idx (setting_id),
  CONSTRAINT setting_id FOREIGN KEY (setting_id) REFERENCES settings (setting_id)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-26 14:50:18
