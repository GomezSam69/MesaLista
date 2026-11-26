SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS mesalista_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mesalista_db;

CREATE TABLE IF NOT EXISTS categorias (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion VARCHAR(255),
  activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS platos (
  id_plato INT AUTO_INCREMENT PRIMARY KEY,
  id_categoria INT NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255),
  precio DECIMAL(10,2) NOT NULL,
  disponible BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_plato_categoria FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_plato_precio CHECK (precio >= 0)
);

CREATE TABLE IF NOT EXISTS mesas (
  id_mesa INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(20) NOT NULL UNIQUE,
  capacidad INT NOT NULL,
  estado ENUM('disponible','ocupada','fuera de servicio') NOT NULL DEFAULT 'disponible',
  CONSTRAINT chk_mesa_capacidad CHECK (capacidad > 0)
);

CREATE TABLE IF NOT EXISTS empleados (
  id_empleado INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(30),
  correo VARCHAR(120),
  cargo VARCHAR(80) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(30),
  correo VARCHAR(120)
);

CREATE TABLE IF NOT EXISTS reservas (
  id_reserva INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente INT NOT NULL,
  id_mesa INT NOT NULL,
  fecha_hora DATETIME NOT NULL,
  personas INT NOT NULL,
  estado ENUM('pendiente','confirmada','cancelada','atendida') NOT NULL DEFAULT 'pendiente',
  CONSTRAINT fk_reserva_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_reserva_mesa FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_reserva_personas CHECK (personas > 0),
  INDEX idx_reserva_fecha (fecha_hora),
  INDEX idx_reserva_estado (estado)
);

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_mesa INT NOT NULL,
  id_empleado INT NOT NULL,
  id_cliente INT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('pendiente','en cocina','entregado','anulado') NOT NULL DEFAULT 'pendiente',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_pedido_mesa FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pedido_empleado FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_pedido_fecha (fecha_hora),
  INDEX idx_pedido_estado (estado),
  INDEX idx_pedido_mesa (id_mesa)
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_plato INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_detalle_plato FOREIGN KEY (id_plato) REFERENCES platos(id_plato)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0),
  CONSTRAINT chk_detalle_precio CHECK (precio_unitario >= 0)
);

INSERT IGNORE INTO categorias(nombre, descripcion) VALUES
('Entradas','Para comenzar'),('Platos fuertes','Platos principales'),('Bebidas','Bebidas frías y calientes'),('Postres','Opciones dulces');

INSERT INTO platos(id_categoria,nombre,descripcion,precio,disponible)
SELECT c.id_categoria, d.nombre, d.descripcion, d.precio, TRUE
FROM (
  SELECT 'Entradas' AS cat,'Arepitas de la casa' AS nombre,'Arepas pequeñas con hogao' AS descripcion,12000 AS precio UNION ALL
  SELECT 'Platos fuertes','Bandeja especial','Preparación tradicional de la casa',28000 UNION ALL
  SELECT 'Bebidas','Limonada natural','Limonada preparada al momento',7000 UNION ALL
  SELECT 'Postres','Postre de la casa','Postre del día',9000
) d
JOIN categorias c ON c.nombre = d.cat
WHERE NOT EXISTS (SELECT 1 FROM platos p WHERE p.nombre = d.nombre);

INSERT IGNORE INTO mesas(numero,capacidad,estado) VALUES
('M1',2,'disponible'),('M2',4,'disponible'),('M3',4,'ocupada'),('M4',6,'disponible');

INSERT INTO empleados(nombre,telefono,correo,cargo,activo)
SELECT 'Laura Gómez','3001234567','laura@mesalista.com','Mesera',TRUE
WHERE NOT EXISTS (SELECT 1 FROM empleados WHERE correo='laura@mesalista.com');

INSERT INTO clientes(nombre,telefono,correo)
SELECT 'Carlos Ramírez','3105550101','carlos@email.com'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE correo='carlos@email.com');

-- Datos de ejemplo de reservas y pedidos (solo si las tablas están vacías)
INSERT INTO reservas(id_cliente,id_mesa,fecha_hora,personas,estado)
SELECT c.id_cliente, m.id_mesa, DATE_ADD(CURDATE(), INTERVAL '1 20' DAY_HOUR), 4, 'confirmada'
FROM clientes c, mesas m
WHERE c.correo='carlos@email.com' AND m.numero='M2'
  AND NOT EXISTS (SELECT 1 FROM reservas);

INSERT INTO pedidos(id_mesa,id_empleado,id_cliente,estado,total)
SELECT m.id_mesa, e.id_empleado, NULL, 'pendiente', 0
FROM mesas m, empleados e
WHERE m.numero='M3' AND e.correo='laura@mesalista.com'
  AND NOT EXISTS (SELECT 1 FROM pedidos);

INSERT INTO detalle_pedido(id_pedido,id_plato,cantidad,precio_unitario,subtotal)
SELECT p.id_pedido, pl.id_plato, 2, pl.precio, pl.precio*2
FROM pedidos p JOIN platos pl ON pl.nombre='Bandeja especial'
WHERE NOT EXISTS (SELECT 1 FROM detalle_pedido);

UPDATE pedidos p
SET total = (SELECT COALESCE(SUM(subtotal),0) FROM detalle_pedido d WHERE d.id_pedido=p.id_pedido)
WHERE p.total = 0 AND EXISTS (SELECT 1 FROM detalle_pedido d WHERE d.id_pedido=p.id_pedido);
