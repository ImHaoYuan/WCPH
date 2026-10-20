-- =============================================================
--  校园委托系统 数据库建表脚本 (DDL)
--  Campus Commission / Campus Errand System
--  目标 DBMS : MySQL 8.0
--  字符集    : utf8mb4 / utf8mb4_general_ci
--  存储引擎  : InnoDB
--
--  用途：
--    1) 直接在 MySQL 8.0 中执行建库建表
--    2) 在 PowerDesigner 中「File -> Reverse Engineer -> Database」
--       选择 MySQL 8.0 作为 DBMS，反向工程生成 PDM 与 ER 图
--
--  实体关系速览：
--    User        1:1  Wallet          （用户与其钱包一一对应）
--    User        1:N  Task            （用户发布多个委托）
--    Category    1:N  Task            （分类下含多个委托）
--    User        1:N  Application     （用户提交多个申请）
--    Task        1:N  Application     （一个委托收到多个申请）
--    Task        1:1  Order           （委托成交后产生唯一订单）
--    Order       1:1  Review          （订单完成后产生唯一评价）
--    User        1:N  Review          （作为评价人 / 被评价人）
--    Wallet      1:N  Transaction     （钱包流水）
--    Order       1:N  Message         （订单内多条沟通消息）
-- =============================================================

DROP DATABASE IF EXISTS campus_commission;
CREATE DATABASE campus_commission
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_general_ci;
USE campus_commission;

-- -------------------------------------------------------------
-- 1. 用户表 user
--    校园委托的参与者，同时可作为委托发布方与接单方
-- -------------------------------------------------------------
CREATE TABLE `user` (
    `user_id`       BIGINT       NOT NULL AUTO_INCREMENT COMMENT '用户ID，主键',
    `username`      VARCHAR(50)  NOT NULL                COMMENT '登录名，唯一',
    `password_hash` CHAR(60)     NOT NULL                COMMENT '密码哈希(bcrypt)，不存明文',
    `real_name`     VARCHAR(50)  DEFAULT NULL            COMMENT '真实姓名',
    `student_no`    VARCHAR(20)  DEFAULT NULL            COMMENT '学号，唯一',
    `phone`         VARCHAR(20)  DEFAULT NULL            COMMENT '手机号，唯一',
    `email`         VARCHAR(100) DEFAULT NULL            COMMENT '邮箱',
    `avatar_url`    VARCHAR(255) DEFAULT NULL            COMMENT '头像地址',
    `verify_status` TINYINT      NOT NULL DEFAULT 0      COMMENT '实名认证状态：0未认证 1审核中 2已认证 3已驳回',
    `credit_score`  INT          NOT NULL DEFAULT 100    COMMENT '信用分，初始100',
    `status`        TINYINT      NOT NULL DEFAULT 1      COMMENT '账号状态：0禁用 1正常',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `uk_user_username`   (`username`),
    UNIQUE KEY `uk_user_student_no` (`student_no`),
    UNIQUE KEY `uk_user_phone`      (`phone`),
    KEY `idx_user_verify_status` (`verify_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- -------------------------------------------------------------
-- 2. 委托分类表 category
-- -------------------------------------------------------------
CREATE TABLE `category` (
    `category_id` BIGINT      NOT NULL AUTO_INCREMENT COMMENT '分类ID，主键',
    `name`        VARCHAR(50) NOT NULL                COMMENT '分类名称，唯一，如代取快递/学习辅导',
    `description` VARCHAR(255) DEFAULT NULL           COMMENT '分类说明',
    `sort_no`     INT         NOT NULL DEFAULT 0      COMMENT '排序号，越小越靠前',
    `enabled`     TINYINT     NOT NULL DEFAULT 1      COMMENT '是否启用：0停用 1启用',
    PRIMARY KEY (`category_id`),
    UNIQUE KEY `uk_category_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='委托分类表';

-- -------------------------------------------------------------
-- 3. 委托任务表 task（核心实体）
-- -------------------------------------------------------------
CREATE TABLE `task` (
    `task_id`      BIGINT        NOT NULL AUTO_INCREMENT COMMENT '委托ID，主键',
    `publisher_id` BIGINT        NOT NULL                COMMENT '发布者用户ID，外键->user',
    `category_id`  BIGINT        NOT NULL                COMMENT '分类ID，外键->category',
    `title`        VARCHAR(100)  NOT NULL                COMMENT '委托标题',
    `description`  TEXT                                  COMMENT '委托详细描述',
    `reward`       DECIMAL(10,2) NOT NULL DEFAULT 0.00   COMMENT '悬赏金额(元)',
    `deadline`     DATETIME      NOT NULL                COMMENT '期望完成时间',
    `place`        VARCHAR(100)  DEFAULT NULL            COMMENT '地点，如某宿舍楼/某教学楼',
    `urgency`      TINYINT       NOT NULL DEFAULT 0      COMMENT '紧急程度：0普通 1加急 2非常紧急',
    `status`       TINYINT       NOT NULL DEFAULT 0      COMMENT '状态：0待接单 1进行中 2已完成 3已取消 4已关闭',
    `view_count`   INT           NOT NULL DEFAULT 0      COMMENT '浏览量',
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
    `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`task_id`),
    KEY `idx_task_publisher` (`publisher_id`),
    KEY `idx_task_category`  (`category_id`),
    KEY `idx_task_status`    (`status`),
    KEY `idx_task_created`   (`created_at`),
    CONSTRAINT `fk_task_publisher` FOREIGN KEY (`publisher_id`) REFERENCES `user` (`user_id`),
    CONSTRAINT `fk_task_category`  FOREIGN KEY (`category_id`)  REFERENCES `category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='委托任务表';

-- -------------------------------------------------------------
-- 4. 接单申请表 application
--    一个委托可收到多条申请(1:N)，被接受的一条对应唯一订单
-- -------------------------------------------------------------
CREATE TABLE `application` (
    `application_id` BIGINT      NOT NULL AUTO_INCREMENT COMMENT '申请ID，主键',
    `task_id`        BIGINT      NOT NULL                COMMENT '委托ID，外键->task',
    `applicant_id`   BIGINT      NOT NULL                COMMENT '申请人用户ID，外键->user',
    `message`        VARCHAR(255) DEFAULT NULL           COMMENT '申请留言/接单说明',
    `status`         TINYINT     NOT NULL DEFAULT 0      COMMENT '申请状态：0待处理 1已接受 2已拒绝 3已撤回',
    `applied_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
    `handled_at`     DATETIME    DEFAULT NULL            COMMENT '处理时间',
    PRIMARY KEY (`application_id`),
    UNIQUE KEY `uk_app_task_applicant` (`task_id`, `applicant_id`),
    KEY `idx_app_applicant` (`applicant_id`),
    KEY `idx_app_status`    (`status`),
    CONSTRAINT `fk_app_task`      FOREIGN KEY (`task_id`)      REFERENCES `task` (`task_id`),
    CONSTRAINT `fk_app_applicant` FOREIGN KEY (`applicant_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接单申请表';

-- -------------------------------------------------------------
-- 5. 订单表 orders
--    与 task 为 1:1（委托被接单后形成唯一成交订单）
-- -------------------------------------------------------------
CREATE TABLE `orders` (
    `order_id`      BIGINT        NOT NULL AUTO_INCREMENT COMMENT '订单ID，主键',
    `order_no`      VARCHAR(32)   NOT NULL                COMMENT '订单编号，业务唯一',
    `task_id`       BIGINT        NOT NULL                COMMENT '委托ID，外键->task，唯一',
    `publisher_id`  BIGINT        NOT NULL                COMMENT '委托方用户ID，外键->user',
    `taker_id`      BIGINT        NOT NULL                COMMENT '接单方用户ID，外键->user',
    `amount`        DECIMAL(10,2) NOT NULL                COMMENT '成交金额(元)',
    `status`        TINYINT       NOT NULL DEFAULT 0      COMMENT '订单状态：0进行中 1待确认 2已完成 3已取消 4已退款',
    `accepted_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '接单时间',
    `finished_at`   DATETIME      DEFAULT NULL            COMMENT '完成时间',
    `cancel_reason` VARCHAR(255)  DEFAULT NULL            COMMENT '取消原因',
    PRIMARY KEY (`order_id`),
    UNIQUE KEY `uk_orders_no`   (`order_no`),
    UNIQUE KEY `uk_orders_task` (`task_id`),
    KEY `idx_orders_publisher` (`publisher_id`),
    KEY `idx_orders_taker`     (`taker_id`),
    KEY `idx_orders_status`    (`status`),
    CONSTRAINT `fk_orders_task`      FOREIGN KEY (`task_id`)      REFERENCES `task` (`task_id`),
    CONSTRAINT `fk_orders_publisher` FOREIGN KEY (`publisher_id`) REFERENCES `user` (`user_id`),
    CONSTRAINT `fk_orders_taker`     FOREIGN KEY (`taker_id`)     REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- -------------------------------------------------------------
-- 6. 评价表 review
--    与 orders 为 1:1；评价人/被评价人均为 user
-- -------------------------------------------------------------
CREATE TABLE `review` (
    `review_id`   BIGINT       NOT NULL AUTO_INCREMENT COMMENT '评价ID，主键',
    `order_id`    BIGINT       NOT NULL                COMMENT '订单ID，外键->orders，唯一',
    `reviewer_id` BIGINT       NOT NULL                COMMENT '评价人用户ID，外键->user',
    `reviewee_id` BIGINT       NOT NULL                COMMENT '被评价人用户ID，外键->user',
    `score`       TINYINT      NOT NULL                COMMENT '评分：1~5 星',
    `content`     VARCHAR(500) DEFAULT NULL            COMMENT '评价内容',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间',
    PRIMARY KEY (`review_id`),
    UNIQUE KEY `uk_review_order` (`order_id`),
    KEY `idx_review_reviewer` (`reviewer_id`),
    KEY `idx_review_reviewee` (`reviewee_id`),
    CONSTRAINT `fk_review_order`    FOREIGN KEY (`order_id`)    REFERENCES `orders` (`order_id`),
    CONSTRAINT `fk_review_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `user` (`user_id`),
    CONSTRAINT `fk_review_reviewee` FOREIGN KEY (`reviewee_id`) REFERENCES `user` (`user_id`),
    CONSTRAINT `chk_review_score`   CHECK (`score` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价表';

-- -------------------------------------------------------------
-- 7. 钱包表 wallet  （与 user 为 1:1）
-- -------------------------------------------------------------
CREATE TABLE `wallet` (
    `wallet_id`  BIGINT        NOT NULL AUTO_INCREMENT COMMENT '钱包ID，主键',
    `user_id`    BIGINT        NOT NULL                COMMENT '用户ID，外键->user，唯一',
    `balance`    DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '可用余额(元)',
    `frozen`     DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '冻结金额(元)，已接单未完成的托管资金',
    `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`wallet_id`),
    UNIQUE KEY `uk_wallet_user` (`user_id`),
    CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`),
    CONSTRAINT `chk_wallet_balance` CHECK (`balance` >= 0),
    CONSTRAINT `chk_wallet_frozen`  CHECK (`frozen`  >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钱包表';

-- -------------------------------------------------------------
-- 8. 资金流水表 transaction
-- -------------------------------------------------------------
CREATE TABLE `transaction` (
    `txn_id`     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '流水ID，主键',
    `wallet_id`  BIGINT        NOT NULL                COMMENT '钱包ID，外键->wallet',
    `order_id`   BIGINT        DEFAULT NULL            COMMENT '关联订单ID，外键->orders，可为空(充值/提现)',
    `type`       TINYINT       NOT NULL                COMMENT '类型：1充值 2提现 3支付托管 4解冻退回 5接单收入 6平台服务费',
    `amount`     DECIMAL(12,2) NOT NULL                COMMENT '变动金额，正为入账负为出账',
    `balance_after` DECIMAL(12,2) NOT NULL             COMMENT '变动后余额，便于对账',
    `remark`     VARCHAR(255)  DEFAULT NULL            COMMENT '备注',
    `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
    PRIMARY KEY (`txn_id`),
    KEY `idx_txn_wallet` (`wallet_id`),
    KEY `idx_txn_order`  (`order_id`),
    KEY `idx_txn_created` (`created_at`),
    CONSTRAINT `fk_txn_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `wallet` (`wallet_id`),
    CONSTRAINT `fk_txn_order`  FOREIGN KEY (`order_id`)  REFERENCES `orders` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资金流水表';

-- -------------------------------------------------------------
-- 9. 站内消息表 message
-- -------------------------------------------------------------
CREATE TABLE `message` (
    `message_id` BIGINT       NOT NULL AUTO_INCREMENT COMMENT '消息ID，主键',
    `order_id`   BIGINT       NOT NULL                COMMENT '所属订单ID，外键->orders',
    `sender_id`  BIGINT       NOT NULL                COMMENT '发送者用户ID，外键->user',
    `receiver_id` BIGINT      NOT NULL                COMMENT '接收者用户ID，外键->user',
    `content`    VARCHAR(500) NOT NULL                COMMENT '消息内容',
    `is_read`    TINYINT      NOT NULL DEFAULT 0      COMMENT '是否已读：0未读 1已读',
    `sent_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
    PRIMARY KEY (`message_id`),
    KEY `idx_msg_order`    (`order_id`),
    KEY `idx_msg_receiver` (`receiver_id`, `is_read`),
    CONSTRAINT `fk_msg_order`     FOREIGN KEY (`order_id`)    REFERENCES `orders` (`order_id`),
    CONSTRAINT `fk_msg_sender`    FOREIGN KEY (`sender_id`)   REFERENCES `user` (`user_id`),
    CONSTRAINT `fk_msg_receiver`  FOREIGN KEY (`receiver_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内消息表';
