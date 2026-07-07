INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
-- administrateur: full access
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'read', true),
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'create', true),
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'update', true),
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'delete', true),
-- tresorier: full access
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'read', true),
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'create', true),
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'update', true),
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'delete', true),
-- commissaire_comptes: read only
('77fedabe-039a-4f2e-9f7b-c665106e3264', 'caisse', 'read', true),
-- censeur: read only
('5a918f05-1b01-455a-b26e-4fd6f244d3da', 'caisse', 'read', true);