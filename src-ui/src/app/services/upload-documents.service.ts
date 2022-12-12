import { Injectable } from '@angular/core'
import { HttpEventType } from '@angular/common/http'
import { FileSystemFileEntry, NgxFileDropEntry } from 'ngx-file-drop'
import {
  ConsumerStatusService,
  FileStatusPhase,
} from './consumer-status.service'
import { DocumentService } from './rest/document.service'
import { Subscription } from 'rxjs'
import { SettingsService } from './settings.service'

@Injectable({
  providedIn: 'root',
})
export class UploadDocumentsService {
  private uploadSubscriptions: Array<Subscription> = []

  constructor(
    private documentService: DocumentService,
    private consumerStatusService: ConsumerStatusService,
    private settings: SettingsService
  ) {}

  uploadFiles(files: NgxFileDropEntry[]) {
    for (const droppedFile of files) {
      if (droppedFile.fileEntry.isFile) {
        const fileEntry = droppedFile.fileEntry as FileSystemFileEntry
        fileEntry.file((file: File) => {
          let formData = new FormData()
          formData.append('document', file, file.name)
          formData.set('owner', this.settings.currentUser.id.toString())
          let status = this.consumerStatusService.newFileUpload(file.name)

          status.message = $localize`Connecting...`

          this.uploadSubscriptions[file.name] = this.documentService
            .uploadDocument(formData)
            .subscribe({
              next: (event) => {
                if (event.type == HttpEventType.UploadProgress) {
                  status.updateProgress(
                    FileStatusPhase.UPLOADING,
                    event.loaded,
                    event.total
                  )
                  status.message = $localize`Uploading...`
                } else if (event.type == HttpEventType.Response) {
                  status.taskId = event.body['task_id']
                  status.message = $localize`Upload complete, waiting...`
                  this.uploadSubscriptions[file.name]?.complete()
                }
              },
              error: (error) => {
                switch (error.status) {
                  case 400: {
                    this.consumerStatusService.fail(
                      status,
                      error.error.document
                    )
                    break
                  }
                  default: {
                    this.consumerStatusService.fail(
                      status,
                      $localize`HTTP error: ${error.status} ${error.statusText}`
                    )
                    break
                  }
                }
                this.uploadSubscriptions[file.name]?.complete()
              },
            })
        })
      }
    }
  }
}
