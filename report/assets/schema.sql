-- Generated from app/models.py with SQLAlchemy against the PostgreSQL
-- dialect. This is the schema the running system creates.

CREATE TABLE users (
	user_id UUID NOT NULL,
	username VARCHAR(100) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	role VARCHAR(20) NOT NULL,
	is_active BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	last_login TIMESTAMP WITH TIME ZONE,
	custom_instructions TEXT,
	work_role VARCHAR(40),
	PRIMARY KEY (user_id),
	CONSTRAINT ck_users_role CHECK (role IN ('user','admin')),
	UNIQUE (username)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE documents (
	document_id UUID NOT NULL,
	user_id UUID NOT NULL,
	title VARCHAR(255) NOT NULL,
	original_filename VARCHAR(255) NOT NULL,
	file_path VARCHAR(500) NOT NULL,
	file_type VARCHAR(10) NOT NULL,
	file_size BIGINT NOT NULL,
	upload_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	processing_status VARCHAR(20) NOT NULL,
	chunk_count INTEGER NOT NULL,
	error_message TEXT,
	stage VARCHAR(20),
	progress INTEGER DEFAULT '0' NOT NULL,
	stage_detail VARCHAR(120),
	pinned BOOLEAN DEFAULT 'false' NOT NULL,
	PRIMARY KEY (document_id),
	CONSTRAINT ck_documents_file_type CHECK (file_type IN ('pdf','docx','txt','md')),
	CONSTRAINT ck_documents_file_size CHECK (file_size > 0),
	CONSTRAINT ck_documents_status CHECK (processing_status IN ('pending','processing','ocr','done','failed')),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_documents_processing_status ON documents (processing_status);
CREATE INDEX ix_documents_user_id ON documents (user_id);

CREATE TABLE password_reset_tokens (
	token_id UUID NOT NULL,
	user_id UUID NOT NULL,
	code_hash VARCHAR(255) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	used BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (token_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);

CREATE TABLE projects (
	project_id UUID NOT NULL,
	user_id UUID NOT NULL,
	name VARCHAR(120) NOT NULL,
	instructions TEXT,
	doc_scope VARCHAR(10) NOT NULL,
	pinned BOOLEAN DEFAULT 'false' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	last_opened_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (project_id),
	CONSTRAINT ck_projects_doc_scope CHECK (doc_scope IN ('all','selected')),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_projects_updated_at ON projects (updated_at);
CREATE INDEX ix_projects_user_id ON projects (user_id);

CREATE TABLE conversations (
	conversation_id UUID NOT NULL,
	user_id UUID NOT NULL,
	project_id UUID,
	title VARCHAR(255) NOT NULL,
	pinned BOOLEAN DEFAULT 'false' NOT NULL,
	unread BOOLEAN DEFAULT 'false' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (conversation_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE SET NULL
);
CREATE INDEX ix_conversations_project_id ON conversations (project_id);
CREATE INDEX ix_conversations_updated_at ON conversations (updated_at);
CREATE INDEX ix_conversations_user_id ON conversations (user_id);

CREATE TABLE project_documents (
	project_id UUID NOT NULL,
	document_id UUID NOT NULL,
	PRIMARY KEY (project_id, document_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(document_id) REFERENCES documents (document_id) ON DELETE CASCADE
);

CREATE TABLE messages (
	message_id UUID NOT NULL,
	conversation_id UUID NOT NULL,
	role VARCHAR(20) NOT NULL,
	content TEXT NOT NULL,
	source_documents JSONB,
	token_count INTEGER,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (message_id),
	CONSTRAINT ck_messages_role CHECK (role IN ('user','assistant')),
	FOREIGN KEY(conversation_id) REFERENCES conversations (conversation_id) ON DELETE CASCADE
);
CREATE INDEX ix_messages_conversation_id ON messages (conversation_id);

CREATE TABLE query_logs (
	log_id UUID NOT NULL,
	user_id UUID,
	conversation_id UUID,
	query_text TEXT NOT NULL,
	response_time_ms INTEGER NOT NULL,
	chunks_retrieved INTEGER NOT NULL,
	llm_provider VARCHAR(50) NOT NULL,
	model_name VARCHAR(100) NOT NULL,
	status VARCHAR(20) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (log_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(conversation_id) REFERENCES conversations (conversation_id) ON DELETE SET NULL
);
CREATE INDEX ix_query_logs_created_at ON query_logs (created_at);
