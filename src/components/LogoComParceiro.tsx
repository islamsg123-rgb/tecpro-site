import Image from "next/image";

/**
 * Logo da Tecpro (sem alteração) + "+" + logo do programa parceiro Programa Forma Brasil.
 * O logo parceiro é verde e amarelo, então fica numa plaquinha branca para aparecer bem
 * sobre o fundo azul-marinho do cabeçalho e do rodapé.
 * Tamanhos: menor no celular, normal a partir de telas médias.
 */
export function LogoComParceiro({ grande = false }: { grande?: boolean }) {
  const alturaTecpro = grande ? "h-9 sm:h-11" : "h-8 sm:h-10";
  const alturaParceiro = grande ? "h-[18px] sm:h-6" : "h-4 sm:h-[22px]";
  return (
    <span className="flex items-center gap-2 sm:gap-3">
      <Image
        src="/logo-tecpro-transparente.png"
        alt="Tecpro Multi Ensino"
        width={453}
        height={165}
        priority
        className={`${alturaTecpro} w-auto shrink-0`}
      />
      <span aria-hidden className="text-xl font-extrabold leading-none text-laranja-500 sm:text-2xl">
        +
      </span>
      <span className="flex shrink-0 items-center rounded-lg bg-white px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2">
        <Image
          src="/logo-forma-brasil.png"
          alt="Programa Forma Brasil"
          width={1000}
          height={167}
          priority
          className={`${alturaParceiro} w-auto`}
        />
      </span>
    </span>
  );
}
