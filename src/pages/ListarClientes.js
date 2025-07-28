// src/pages/ListarClientes.js
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const ListarClientes = () => {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientes(lista);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="lista-clientes">
      <h2 className="titulo-lista">Clientes Registrados</h2>
      <ul className="lista">
        {clientes.map((cliente) => (
          <li key={cliente.id} className="item-cliente">
            <strong>{cliente.cedula}</strong> - {cliente.nombre} {cliente.apellido} - {cliente.telefono}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ListarClientes;
