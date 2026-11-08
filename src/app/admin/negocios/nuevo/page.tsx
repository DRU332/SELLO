import { NewBusinessForm } from "./NewBusinessForm";

export default function NewBusinessPage() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Nuevo negocio</h1>
      <p className="text-sm text-stone-600">
        Se crea el negocio con las reglas por defecto (8 sellos, 2 de regalo, 30 minutos entre sellos) y una cuenta para el dueño
        con una contraseña generada al azar. El dueño termina de configurar su tarjeta desde su panel.
      </p>
      <NewBusinessForm />
    </div>
  );
}
