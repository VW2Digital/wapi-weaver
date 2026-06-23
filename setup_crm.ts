import db from "./src/lib/db";

async function run() {
  console.log("Starting CRM database setup and seed...");

  try {
    // 1. Create tables one by one (identical to schema_mysql.sql definitions)
    console.log("Creating sales_funnels table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS sales_funnels (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(180) NOT NULL,
        description TEXT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_by_user_id VARCHAR(36) NULL,
        updated_by_user_id VARCHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        UNIQUE KEY uq_sales_funnels_user_slug (user_id, slug),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating sales_stages table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS sales_stages (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        funnel_id VARCHAR(36) NOT NULL,
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(180) NOT NULL,
        description TEXT NULL,
        color VARCHAR(30) NULL,
        probability_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        sort_order INT NOT NULL DEFAULT 0,
        is_won_stage BOOLEAN NOT NULL DEFAULT FALSE,
        is_lost_stage BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_user_id VARCHAR(36) NULL,
        updated_by_user_id VARCHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        UNIQUE KEY uq_sales_stages_funnel_slug (funnel_id, slug),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_lost_reasons table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_lost_reasons (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_lost_reasons_user_name (user_id, name),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunities table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        funnel_id VARCHAR(36) NOT NULL,
        stage_id VARCHAR(36) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        primary_contact_id VARCHAR(36) NULL,
        company_name VARCHAR(255) NULL,
        owner_user_id VARCHAR(36) NULL,
        created_by_user_id VARCHAR(36) NULL,
        updated_by_user_id VARCHAR(36) NULL,
        value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        currency CHAR(3) NOT NULL DEFAULT 'BRL',
        probability_percent DECIMAL(5,2) NULL,
        expected_close_date DATE NULL,
        closed_at DATETIME NULL,
        status ENUM('open', 'won', 'lost', 'paused', 'archived') NOT NULL DEFAULT 'open',
        source VARCHAR(100) NULL,
        temperature ENUM('cold', 'warm', 'hot') NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
        lost_reason_id VARCHAR(36) NULL,
        lost_reason_text TEXT NULL,
        kanban_order DECIMAL(20,10) NOT NULL DEFAULT 0,
        last_activity_at DATETIME NULL,
        next_activity_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE RESTRICT,
        FOREIGN KEY (stage_id) REFERENCES sales_stages(id) ON DELETE RESTRICT,
        FOREIGN KEY (primary_contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (lost_reason_id) REFERENCES opportunity_lost_reasons(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_contacts table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_contacts (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        opportunity_id VARCHAR(36) NOT NULL,
        contact_id VARCHAR(36) NOT NULL,
        role VARCHAR(100) NULL,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_opportunity_contact (opportunity_id, contact_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_stage_history table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_stage_history (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        opportunity_id VARCHAR(36) NOT NULL,
        funnel_id VARCHAR(36) NOT NULL,
        from_stage_id VARCHAR(36) NULL,
        to_stage_id VARCHAR(36) NOT NULL,
        moved_by_user_id VARCHAR(36) NULL,
        moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reason TEXT NULL,
        old_status VARCHAR(50) NULL,
        new_status VARCHAR(50) NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE CASCADE,
        FOREIGN KEY (from_stage_id) REFERENCES sales_stages(id) ON DELETE SET NULL,
        FOREIGN KEY (to_stage_id) REFERENCES sales_stages(id) ON DELETE CASCADE,
        FOREIGN KEY (moved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_activities table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_activities (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        opportunity_id VARCHAR(36) NOT NULL,
        contact_id VARCHAR(36) NULL,
        assigned_to_user_id VARCHAR(36) NULL,
        created_by_user_id VARCHAR(36) NULL,
        type ENUM('call', 'email', 'meeting', 'task', 'note', 'whatsapp', 'proposal', 'follow_up', 'other') NOT NULL DEFAULT 'task',
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        status ENUM('pending', 'done', 'canceled') NOT NULL DEFAULT 'pending',
        due_at DATETIME NULL,
        completed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_notes table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_notes (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        opportunity_id VARCHAR(36) NOT NULL,
        user_id_creator VARCHAR(36) NULL,
        body TEXT NOT NULL,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id_creator) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_tags pivot table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_tags (
        opportunity_id VARCHAR(36) NOT NULL,
        tag_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (opportunity_id, tag_id),
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating opportunity_audit_logs table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunity_audit_logs (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        opportunity_id VARCHAR(36) NULL,
        user_id_actor VARCHAR(36) NULL,
        action VARCHAR(100) NOT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id_actor) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Indexes
    console.log("Creating optimization indexes...");
    const createIndexSafe = async (stmt: string) => {
      try {
        await db.query(stmt);
      } catch (e) {
        // Ignore duplicate index errors
      }
    };

    await createIndexSafe(
      "CREATE INDEX idx_opportunities_funnel_stage_order ON opportunities(user_id, funnel_id, stage_id, kanban_order)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opportunities_status ON opportunities(user_id, status)",
    );
    await createIndexSafe("CREATE INDEX idx_opportunities_owner ON opportunities(owner_user_id)");
    await createIndexSafe(
      "CREATE INDEX idx_opportunities_primary_contact ON opportunities(primary_contact_id)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opportunities_expected_close ON opportunities(expected_close_date)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opportunities_last_act ON opportunities(last_activity_at)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opportunities_next_act ON opportunities(next_activity_at)",
    );
    await createIndexSafe("CREATE INDEX idx_opportunities_deleted ON opportunities(deleted_at)");
    await createIndexSafe(
      "CREATE INDEX idx_opt_contacts_contact ON opportunity_contacts(contact_id)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opt_contacts_primary ON opportunity_contacts(opportunity_id, is_primary)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_stage_history_opp ON opportunity_stage_history(opportunity_id)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_stage_history_funnel ON opportunity_stage_history(funnel_id)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_stage_history_moved ON opportunity_stage_history(moved_at)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opt_activities_opp ON opportunity_activities(opportunity_id)",
    );
    await createIndexSafe("CREATE INDEX idx_opt_activities_due ON opportunity_activities(due_at)");
    await createIndexSafe(
      "CREATE INDEX idx_opt_activities_status ON opportunity_activities(status)",
    );
    await createIndexSafe("CREATE INDEX idx_opt_notes_opp ON opportunity_notes(opportunity_id)");
    await createIndexSafe("CREATE INDEX idx_opt_notes_pinned ON opportunity_notes(is_pinned)");
    await createIndexSafe(
      "CREATE INDEX idx_opt_audit_opp ON opportunity_audit_logs(opportunity_id)",
    );
    await createIndexSafe(
      "CREATE INDEX idx_opt_audit_created ON opportunity_audit_logs(created_at)",
    );

    // 3. Seeding for all existing users
    console.log("Retrieving existing users...");
    const users = await db.query("SELECT id FROM users");

    for (const u of users) {
      const userId = u.id;
      console.log(`Seeding CRM defaults for user: ${userId}`);

      // Check if user already has a default funnel
      const existingFunnels = await db.query(
        "SELECT id FROM sales_funnels WHERE user_id = ? AND is_default = TRUE LIMIT 1",
        [userId],
      );

      let funnelId: string;
      if (existingFunnels && existingFunnels.length > 0) {
        funnelId = existingFunnels[0].id;
        console.log(`User already has default funnel with ID: ${funnelId}`);
      } else {
        // Insert default funnel
        funnelId = crypto.randomUUID();
        await db.query(
          `
          INSERT INTO sales_funnels (id, user_id, name, slug, description, is_default, is_active, sort_order)
          VALUES (?, ?, 'Vendas', 'vendas', 'Funil de vendas padrão', TRUE, TRUE, 0)
        `,
          [funnelId, userId],
        );
        console.log(`Created default funnel: ${funnelId}`);
      }

      // Default stages list
      const defaultStages = [
        {
          name: "Novo lead",
          slug: "novo-lead",
          color: "#3b82f6",
          probability: 10,
          is_won: false,
          is_lost: false,
          sort: 1,
        },
        {
          name: "Em contato",
          slug: "em-contato",
          color: "#a855f7",
          probability: 25,
          is_won: false,
          is_lost: false,
          sort: 2,
        },
        {
          name: "Qualificação",
          slug: "qualificacao",
          color: "#eab308",
          probability: 50,
          is_won: false,
          is_lost: false,
          sort: 3,
        },
        {
          name: "Proposta enviada",
          slug: "proposta-enviada",
          color: "#f97316",
          probability: 75,
          is_won: false,
          is_lost: false,
          sort: 4,
        },
        {
          name: "Negociação",
          slug: "negociacao",
          color: "#06b6d4",
          probability: 90,
          is_won: false,
          is_lost: false,
          sort: 5,
        },
        {
          name: "Ganho",
          slug: "ganho",
          color: "#22c55e",
          probability: 100,
          is_won: true,
          is_lost: false,
          sort: 6,
        },
        {
          name: "Perdido",
          slug: "perdido",
          color: "#ef4444",
          probability: 0,
          is_won: false,
          is_lost: true,
          sort: 7,
        },
      ];

      for (const st of defaultStages) {
        const stageExists = await db.query(
          "SELECT id FROM sales_stages WHERE funnel_id = ? AND slug = ? LIMIT 1",
          [funnelId, st.slug],
        );
        if (!stageExists || stageExists.length === 0) {
          const stageId = crypto.randomUUID();
          await db.query(
            `
            INSERT INTO sales_stages (id, user_id, funnel_id, name, slug, color, probability_percent, sort_order, is_won_stage, is_lost_stage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              stageId,
              userId,
              funnelId,
              st.name,
              st.slug,
              st.color,
              st.probability,
              st.sort,
              st.is_won,
              st.is_lost,
            ],
          );
        }
      }

      // Default lost reasons
      const defaultLostReasons = [
        { name: "Preço", desc: "Cliente achou o valor muito alto", sort: 1 },
        { name: "Sem resposta", desc: "Cliente parou de responder os contatos", sort: 2 },
        { name: "Concorrente", desc: "Fechou com outra solução concorrente", sort: 3 },
        { name: "Sem orçamento", desc: "Sem verba aprovada no momento", sort: 4 },
        { name: "Não era o momento", desc: "Decidiu adiar a decisão de compra", sort: 5 },
        { name: "Outro", desc: "Outros motivos não listados", sort: 6 },
      ];

      for (const lr of defaultLostReasons) {
        const reasonExists = await db.query(
          "SELECT id FROM opportunity_lost_reasons WHERE user_id = ? AND name = ? LIMIT 1",
          [userId, lr.name],
        );
        if (!reasonExists || reasonExists.length === 0) {
          const reasonId = crypto.randomUUID();
          await db.query(
            `
            INSERT INTO opportunity_lost_reasons (id, user_id, name, description, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `,
            [reasonId, userId, lr.name, lr.desc, lr.sort],
          );
        }
      }
    }

    console.log("CRM database setup and seeding completed successfully!");
  } catch (error) {
    console.error("Error setting up CRM database:", error);
    process.exit(1);
  }
  process.exit(0);
}

run();
