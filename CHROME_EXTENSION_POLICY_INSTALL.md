# Автоматическая установка расширения Chrome через Policy

Этот метод позволяет автоматически устанавливать расширение Chrome на компьютеры пользователей через системные политики Windows.

## Преимущества

- ✅ Автоматическая установка без участия пользователя
- ✅ Пользователь не может удалить расширение
- ✅ Подходит для корпоративного развертывания
- ✅ Работает с Chrome и Edge
- ✅ Не требует ручной загрузки .crx файлов

## Подготовка

### 1. Получите Extension ID

Extension ID можно найти в URL вашего расширения в Chrome Web Store:

```
https://chrome.google.com/webstore/detail/[EXTENSION_ID]
```

Например: `abcdefghijklmnopqrstuvwxyz123456`

### 2. Настройте скрипт

Откройте [serverVideoCapture/install_chrome_extension.ts](serverVideoCapture/install_chrome_extension.ts) и замените:

```typescript
const EXTENSION_ID = "YOUR_CHROME_STORE_EXTENSION_ID";
```

на ваш реальный Extension ID:

```typescript
const EXTENSION_ID = "abcdefghijklmnopqrstuvwxyz123456";
```

## Генерация установщиков

```bash
# Запустите скрипт для генерации всех установочных файлов
bun run install:chrome-extension
```

Будут созданы файлы в [serverVideoCapture/runtime](serverVideoCapture/runtime):
- `install_chrome_extension.reg` - файл реестра
- `install_chrome_extension.bat` - batch установщик
- `install_chrome_extension.ps1` - PowerShell установщик (рекомендуется)
- `uninstall_chrome_extension.ps1` - деинсталлятор
- `CHROME_EXTENSION_INSTALL_README.md` - инструкция

## Методы установки

### Метод 1: PowerShell (Рекомендуется)

```powershell
# Запустите от имени администратора
.\serverVideoCapture\runtime\install_chrome_extension.ps1
```

### Метод 2: Batch файл

```batch
REM Запустите от имени администратора
.\serverVideoCapture\runtime\install_chrome_extension.bat
```

### Метод 3: Registry файл

1. Дважды кликните `install_chrome_extension.reg`
2. Подтвердите добавление в реестр
3. Перезапустите Chrome

### Метод 4: Программная установка

```typescript
import { ChromeExtensionPolicyInstaller } from "./serverVideoCapture/install_chrome_extension";

const installer = new ChromeExtensionPolicyInstaller({
  extensionId: "your-extension-id",
  forceInstall: true,
});

// Генерация файлов
installer.generateInstallers();

// Автоматическая установка (требует прав администратора)
await installer.autoInstall();
```

## Проверка установки

### 1. Проверка политик Chrome

Откройте в Chrome:
```
chrome://policy
```

Найдите `ExtensionInstallForcelist` - должен содержать ваш Extension ID.

### 2. Проверка расширений

Откройте:
```
chrome://extensions
```

Ваше расширение должно быть установлено и помечено как "Managed by your organization".

### 3. Проверка реестра

```powershell
# Проверка HKLM
Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"

# Проверка HKCU
Get-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
```

## Удаление

```powershell
# Запустите от имени администратора
.\serverVideoCapture\runtime\uninstall_chrome_extension.ps1
```

Или удалите ключи реестра вручную:
```powershell
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" -Name "1"
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" -Name "1"
```

## Корпоративное развертывание

### Через Group Policy (GPO)

1. Откройте Group Policy Editor
2. Перейдите в:
   ```
   Computer Configuration → Administrative Templates → Google → Google Chrome → Extensions
   ```
3. Настройте "Configure the list of force-installed apps and extensions"
4. Добавьте: `your-extension-id;https://clients2.google.com/service/update2/crx`

### Через SCCM/Intune

Используйте сгенерированный `.reg` файл или PowerShell скрипт для развертывания через SCCM или Microsoft Intune.

### Через логин скрипт

Добавьте PowerShell скрипт в login script для автоматической установки при входе пользователя.

## Типы политик

### ExtensionInstallForcelist
- Принудительная установка
- Пользователь **НЕ** может удалить
- Отображается "Managed by your organization"

### ExtensionInstallAllowlist
- Разрешает установку
- Пользователь может удалить
- Обход ограничений корпоративной политики

Измените в скрипте:
```typescript
forceInstall: false  // для allowlist вместо forcelist
```

## Troubleshooting

### Расширение не устанавливается

1. **Проверьте Extension ID**
   ```powershell
   Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
   ```

2. **Проверьте, что расширение опубликовано**
   - Откройте `https://chrome.google.com/webstore/detail/[YOUR_ID]`
   - Убедитесь, что расширение доступно публично

3. **Проверьте логи Chrome**
   ```bash
   chrome.exe --enable-logging --v=1
   # Логи в %LOCALAPPDATA%\Google\Chrome\User Data\chrome_debug.log
   ```

4. **Проверьте права**
   - Убедитесь, что скрипт запущен от администратора
   - Проверьте наличие записей в реестре

### Конфликт с существующими политиками

Если у вас уже есть корпоративные политики Chrome:
```powershell
# Просмотр всех политик
Get-ChildItem -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Recurse
```

### Edge вместо Chrome

Скрипт автоматически поддерживает Edge. Проверьте:
```
edge://policy
edge://extensions
```

## Интеграция с autorun

Добавьте установку расширения в ваш [serverVideoCapture/autorun.ts](serverVideoCapture/autorun.ts):

```typescript
// В serverVideoCapture/autorun.ts
import { ChromeExtensionPolicyInstaller } from "./install_chrome_extension";

// При первом запуске
const installer = new ChromeExtensionPolicyInstaller({
  extensionId: "your-id",
  forceInstall: true,
});

installer.generateInstallers();
// await installer.autoInstall(); // если нужна автоматическая установка
```

## Важные примечания

⚠️ **Требуются права администратора** для установки на уровне HKLM

⚠️ **Расширение должно быть опубликовано** в Chrome Web Store

⚠️ **Пользователь увидит** сообщение "Managed by your organization"

⚠️ **Antivirus может блокировать** изменения реестра - добавьте в исключения

## Альтернативные методы

Если Chrome Policy не подходит:

1. **Ручная установка** - пользователь устанавливает из Chrome Web Store
2. **Enterprise Policy Files** - JSON конфигурация вместо реестра
3. **CRX файл** - загрузка и установка локального .crx файла
4. **Developer Mode** - распаковка расширения в папку

См. [BUILD_README.md](BUILD_README.md) для других методов установки.

## Пример использования в коде

```typescript
import { ChromeExtensionPolicyInstaller } from "./serverVideoCapture/install_chrome_extension";

async function setupExtension() {
  // Создаем установщик
  const installer = new ChromeExtensionPolicyInstaller({
    extensionId: "abcdefghijklmnop", // Ваш реальный ID
    forceInstall: true, // Принудительная установка
  });

  // Генерируем все файлы
  const files = installer.generateInstallers();
  
  console.log("Файлы созданы:");
  console.log("- Registry:", files.regFile);
  console.log("- Batch:", files.batchFile);
  console.log("- PowerShell:", files.powerShellFile);
  console.log("- Uninstaller:", files.uninstallerFile);
  console.log("- README:", files.readmeFile);

  // Опционально: автоматическая установка
  const success = await installer.autoInstall();
  if (success) {
    console.log("Расширение успешно установлено!");
  } else {
    console.log("Установите вручную, запустив PowerShell скрипт");
  }
}

setupExtension();
```

## Дополнительная информация

- [Chrome Enterprise Policy List](https://chromeenterprise.google/policies/)
- [ExtensionInstallForcelist Documentation](https://chromeenterprise.google/policies/#ExtensionInstallForcelist)
- [Managing Chrome Extensions](https://support.google.com/chrome/a/answer/9296680)
