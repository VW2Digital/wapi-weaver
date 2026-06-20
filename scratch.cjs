const fs = require('fs');
let content = fs.readFileSync('src/routes/_app/settings.tsx', 'utf-8');
const startIndex = content.indexOf('function QRCodeSection() {');
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
  const newFunc = `function QRCodeSection() {
  const fetchQRList = useServerFn(listQRCodes);
  const [qrList, setQrList] = useState<any[] | null>(null);
  
  const qrMut = useMutation({
    mutationFn: () => fetchQRList(),
    onSuccess: (r: any) => {
      if (r.ok) setQrList(r.data);
      else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_qr_collapsed",
    true
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" /> QR Codes do WhatsApp
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Liste todos os QR Codes associados à sua conta do WhatsApp Business.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <Button 
              onClick={() => qrMut.mutate()} 
              disabled={qrMut.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={\`h-4 w-4 mr-2 \${qrMut.isPending ? "animate-spin" : ""}\`} />
              Atualizar Lista
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="shrink-0 gap-1"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-6">
          {!qrList && !qrMut.isPending && (
            <div className="text-center py-6 border border-dashed rounded-lg">
              <QrCode className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Clique em atualizar para carregar os QR Codes.</p>
              <Button onClick={() => qrMut.mutate()} className="mt-4" variant="secondary">
                Carregar QR Codes
              </Button>
            </div>
          )}

          {qrMut.isPending && !qrList && (
            <div className="text-center py-6">
              <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Buscando QR Codes...</p>
            </div>
          )}

          {qrList && qrList.length === 0 && (
            <div className="text-center py-6 border border-dashed rounded-lg">
              <p className="text-muted-foreground">Nenhum QR Code encontrado na conta.</p>
            </div>
          )}

          {qrList && qrList.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {qrList.map((qr: any) => (
                <Card key={qr.code} className="overflow-hidden flex flex-col">
                  <div className="p-4 bg-muted/20 flex justify-center">
                    {qr.qr_image_url ? (
                      <div className="rounded-xl overflow-hidden shadow-sm bg-white p-2 border">
                        <img src={qr.qr_image_url} alt="QR Code" className="w-32 h-32 object-contain" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-xl border">
                        <QrCode className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">Código: <span className="font-mono text-xs">{qr.code}</span></p>
                      </div>
                    </div>
                    
                    {qr.prefilled_message && (
                      <div className="bg-muted p-2 rounded text-xs text-muted-foreground line-clamp-2">
                        "{qr.prefilled_message}"
                      </div>
                    )}
                    
                    <div className="mt-auto pt-2 flex items-center justify-between border-t gap-2">
                      <a 
                        href={qr.deep_link_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-primary hover:underline font-mono truncate max-w-[150px]"
                        title={qr.deep_link_url}
                      >
                        wa.me/...
                      </a>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                        navigator.clipboard.writeText(qr.deep_link_url);
                        toast.success("Link copiado!");
                      }}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
`;
  content += newFunc;
  fs.writeFileSync('src/routes/_app/settings.tsx', content);
}
